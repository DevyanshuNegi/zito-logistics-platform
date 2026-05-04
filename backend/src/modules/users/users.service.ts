import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, AccountStatus, Prisma } from '@prisma/client';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CURRENCY_CODES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  type SupportedCurrencyCode,
  type SupportedLanguageCode,
} from '../../config/app.config';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadKycDto } from './dto/upload-kyc.dto';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';

// PRD §4 — Inline Multer type (avoids @types/multer dependency)
interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// PRD §42 — Admin user list filter options
interface FindAllOptions {
  page: number;
  limit: number;
  role?: UserRole;
  status?: string;
  agencyId?: string;
}

// PRD §4 — KYC document types required per role
export const KYC_REQUIRED_DOCS: Record<string, string[]> = {
  CUSTOMER:          ['NATIONAL_ID'],
  DRIVER:            ['NATIONAL_ID', 'DRIVERS_LICENSE'],
  AGENT:             ['NATIONAL_ID', 'BUSINESS_REG', 'VEHICLE_REG'],
  TRANSPORTER:       ['NATIONAL_ID', 'BUSINESS_REG', 'VEHICLE_REG'],
  CORPORATE:         ['NATIONAL_ID', 'BUSINESS_REG'],
  WAREHOUSE_PARTNER: ['NATIONAL_ID', 'BUSINESS_REG'],
};

// PRD §4 — Compliance: alert 15 days before expiry
const EXPIRY_ALERT_DAYS = 15;
const MAX_FILE_SIZE     = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private preferencesKey(userId: string) {
    return `user-preferences:${userId}`;
  }

  private asPreferencesRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    return {
      language:
        typeof record.language === 'string' &&
        SUPPORTED_LANGUAGE_CODES.includes(record.language as SupportedLanguageCode)
          ? (record.language as SupportedLanguageCode)
          : DEFAULT_LANGUAGE,
      currency:
        typeof record.currency === 'string' &&
        SUPPORTED_CURRENCY_CODES.includes(record.currency as SupportedCurrencyCode)
          ? (record.currency as SupportedCurrencyCode)
          : DEFAULT_CURRENCY,
      updatedAt:
        typeof record.updatedAt === 'string'
          ? record.updatedAt
          : new Date().toISOString(),
    };
  }

  // ─── FIND ONE ─────────────────────────────────────────────────────────────

  // PRD §4 — Get profile + account status (used by pending-approval screen)
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id:        true,
        fullName:  true,
        email:     true,
        phone:     true,
        role:      true,
        status:    true,
        agencyId:  true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── FIND ALL ─────────────────────────────────────────────────────────────

  // PRD §42 — Admin list: paginated, filterable by role, status, agency
  async findAll({ page, limit, role, status, agencyId }: FindAllOptions) {
    const skip  = (page - 1) * limit;
    const where: any = {};
    if (role)     where.role     = role;
    if (status)   where.status   = status;
    if (agencyId) where.agencyId = agencyId;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id:        true,
          fullName:  true,
          email:     true,
          phone:     true,
          role:      true,
          status:    true,
          agencyId:  true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  // ─── UPDATE PROFILE ───────────────────────────────────────────────────────

  // PRD §4 — Only fullName, email, phone are user-editable; role/status locked
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        
        ...(dto.email    && { email: dto.email.toLowerCase().trim() }),
        ...(dto.phone    && { phone: dto.phone.trim() }),
      },
    });
  }

  async getPreferences(userId: string) {
    await this.findOne(userId);

    const record = await this.prisma.idempotencyRecord.findUnique({
      where: { key: this.preferencesKey(userId) },
      select: { response: true },
    });

    const stored = this.asPreferencesRecord(record?.response);

    return {
      language: stored?.language ?? DEFAULT_LANGUAGE,
      currency: stored?.currency ?? DEFAULT_CURRENCY,
      updatedAt: stored?.updatedAt ?? null,
      supportedLanguages: SUPPORTED_LANGUAGE_CODES.map((code) => SUPPORTED_LANGUAGES[code]),
      supportedCurrencies: SUPPORTED_CURRENCY_CODES.map((code) => SUPPORTED_CURRENCIES[code]),
    };
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto) {
    const current = await this.getPreferences(userId);
    const language = dto.language ?? current.language;
    const currency = dto.currency ?? current.currency;
    const updatedAt = new Date().toISOString();

    await this.prisma.idempotencyRecord.upsert({
      where: { key: this.preferencesKey(userId) },
      create: {
        key: this.preferencesKey(userId),
        status: 'ACTIVE',
        requestHash: userId,
        response: {
          language,
          currency,
          updatedAt,
        } as Prisma.InputJsonValue,
      },
      update: {
        status: 'ACTIVE',
        requestHash: userId,
        response: {
          language,
          currency,
          updatedAt,
        } as Prisma.InputJsonValue,
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'USER_PREFERENCES_UPDATED',
          entityType: 'USER',
          entityId: userId,
          details: {
            language,
            currency,
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Preference updates should not fail because audit logging was unavailable.
    }

    return this.getPreferences(userId);
  }

  // ─── ROLE ─────────────────────────────────────────────────────────────────

  // PRD §2 — SUPER_ADMIN only: change user role
  async updateRole(id: string, role: UserRole) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  // ─── STATUS ───────────────────────────────────────────────────────────────

  // PRD §3 — Account lifecycle: pending → verified → active → suspended → rejected
  async setStatus(id: string, status: AccountStatus) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  // ─── KYC ──────────────────────────────────────────────────────────────────

  // PRD §4 — Upload KYC document; sets status to VERIFIED after upload
  // Schema field: `type` (not documentType)
  async uploadKycDocument(userId: string, file: MulterFile, dto: UploadKycDto) {
    await this.findOne(userId);

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: JPEG, PNG, PDF');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large. Maximum size is 5MB');
    }

    const fileUrl = `kyc/${userId}/${dto.documentType}/${Date.now()}_${file.originalname}`;

    const doc = await this.prisma.kycDocument.create({
      data: {
        userId,
        type:       dto.documentType,   // schema field is `type`
        fileUrl,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        status:     'PENDING',
      },
    });

    // PRD §3 — Set user to VERIFIED after first document upload
    await this.prisma.user.update({
      where: { id: userId },
      data:  { status: AccountStatus.VERIFIED },
    });

    return doc;
  }

  // PRD §4 — Get all KYC documents for a user
  async getKycDocuments(userId: string) {
    await this.findOne(userId);
    return this.prisma.kycDocument.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // PRD §4 — Admin approve or reject a KYC document
  async verifyKycDocument(
    userId:     string,
    documentId: string,
    status:     'APPROVED' | 'REJECTED',
    reason?:    string,
  ) {
    const doc = await this.prisma.kycDocument.findFirst({
      where: { id: documentId, userId },
    });
    if (!doc) throw new NotFoundException('KYC document not found');

    // Schema has: status, verifiedAt, verifiedBy — no rejectionReason field
    const updated = await this.prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status,
        verifiedAt: status === 'APPROVED' ? new Date() : null,
        // verifiedBy: set to reviewer ID if needed — pass via params
      },
    });

    // PRD §4 — If all required docs approved → activate account
    if (status === 'APPROVED') {
      const user        = await this.prisma.user.findUnique({ where: { id: userId } });
      const requiredDocs = KYC_REQUIRED_DOCS[user?.role ?? ''] ?? ['NATIONAL_ID'];
      const approvedDocs = await this.prisma.kycDocument.findMany({
        where:  { userId, status: 'APPROVED' },
        select: { type: true },               // schema field is `type`
      });
      const approvedTypes = approvedDocs.map((d) => d.type);
      const allApproved   = requiredDocs.every((r) => approvedTypes.includes(r));
      if (allApproved) {
        await this.setStatus(userId, AccountStatus.ACTIVE);
      }
    }

    return updated;
  }

  // PRD §4 — Compliance: auto-suspend expired docs (drivers/transporters)
  async checkExpiringDocuments(): Promise<void> {
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + EXPIRY_ALERT_DAYS);

    // PRD §4 — Expired docs → auto suspend driver/transporter
    const expiredDocs = await this.prisma.kycDocument.findMany({
      where: {
        status:     'APPROVED',
        expiryDate: { lte: new Date() },
      },
      include: { user: { select: { id: true, role: true } } },
    });

    for (const doc of expiredDocs) {
      if (
        doc.user.role === UserRole.DRIVER ||
        doc.user.role === UserRole.TRANSPORTER
      ) {
        await this.setStatus(doc.user.id, AccountStatus.SUSPENDED);
        await this.prisma.kycDocument.update({
          where: { id: doc.id },
          data:  { status: 'EXPIRED' },
        });
      }
    }
  }
}
