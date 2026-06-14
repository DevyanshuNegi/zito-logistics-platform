import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, AccountStatus, Prisma, StaffDepartment } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { StorageService } from '../storage/storage.service';

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

const INTERNAL_PROVISIONABLE_ROLES = new Set<UserRole>([
  UserRole.CUSTOMER,
  UserRole.CORPORATE,
  UserRole.DRIVER,
  UserRole.AGENT,
  UserRole.TRANSPORTER,
  UserRole.COURIER_COMPANY,
  UserRole.WAREHOUSE_PARTNER,
  UserRole.AGENCY_STAFF,
]);

const ORGANIZATION_ACCOUNT_ROLES = new Set<UserRole>([
  UserRole.CORPORATE,
  UserRole.AGENT,
  UserRole.TRANSPORTER,
  UserRole.COURIER_COMPANY,
  UserRole.WAREHOUSE_PARTNER,
]);

const STAFF_DEPARTMENT_OPTIONS = new Set(['OPERATIONS', 'CUSTOMER_CARE', 'ACCOUNTS']);
const STAFF_SCOPE_OPTIONS = new Set(['HEAD_OFFICE', 'AGENCY']);
const HEAD_OFFICE_AGENCY_NAME = 'Zito Head Office';

// PRD §4 — KYC document types required per role
export const KYC_REQUIRED_DOCS: Record<string, string[]> = {
  CUSTOMER:          ['NATIONAL_ID', 'PROFILE_PHOTO'],
  DRIVER:            ['NATIONAL_ID', 'DRIVERS_LICENSE', 'TRANSPORT_PERMIT', 'PROFILE_PHOTO'],
  AGENT:             ['NATIONAL_ID', 'BUSINESS_PROOF', 'ADDRESS_VERIFICATION'],
  TRANSPORTER:       ['BUSINESS_REG', 'VEHICLE_REG', 'INSURANCE', 'DRIVER_ASSIGNMENT'],
  COURIER_COMPANY:   ['BUSINESS_REG', 'OPERATING_LICENSE', 'FLEET_DETAILS'],
  CORPORATE:         ['BUSINESS_REG', 'TAX_CERTIFICATE', 'AUTHORIZED_PERSON_ID', 'COMPANY_DETAILS'],
  WAREHOUSE_PARTNER: ['WAREHOUSE_OWNERSHIP_PROOF', 'COMPLIANCE_CERTIFICATE', 'BUSINESS_REG'],
};

// PRD §4 — Compliance: alert 15 days before expiry
const EXPIRY_ALERT_DAYS = 15;
const MAX_FILE_SIZE     = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const CAMERA_KYC_MIME_TYPES = ['image/jpeg', 'image/png'];
const VERIFICATION_TARGET_ROLES: UserRole[] = [
  UserRole.CUSTOMER,
  UserRole.CORPORATE,
  UserRole.DRIVER,
  UserRole.AGENT,
  UserRole.TRANSPORTER,
  UserRole.COURIER_COMPANY,
  UserRole.WAREHOUSE_PARTNER,
];
const TRUCK_VERIFICATION_TYPES = new Set([
  'TRUCK_3T',
  'TRUCK_7T',
  'TRUCK_14T',
  'TRUCK_22T',
  'CONTAINER_20FT',
  'CONTAINER_40FT',
  'REFRIGERATED',
]);
// Module 5: Photo categories aligned with VehiclePhotoType enum (PRD §9)
const TRUCK_PHOTO_CATEGORIES = [
  'PLATE',         // License plate close-up
  'FRONT',         // Front view
  'RIGHT',         // Right side view
  'LEFT',          // Left side view
  'REAR',          // Rear/back view
  'CHASSIS',       // Chassis/VIN evidence view
  'INSURANCE',     // Insurance document photo
  'LOGBOOK',
  'NTSA_INSPECTION',
  'GOODS_TRANSPORT_LICENSE',
  'ROAD_SERVICE_LICENSE',
  'AXLE_LOAD_CERTIFICATE',
] as const;
const COMPLIANCE_SUSPEND_ROLES = new Set<UserRole>([
  UserRole.DRIVER,
  UserRole.AGENT,
  UserRole.TRANSPORTER,
  UserRole.COURIER_COMPANY,
  UserRole.WAREHOUSE_PARTNER,
]);
const REVIEW_OVERDUE_HOURS = 48;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  private preferencesKey(userId: string) {
    return `user-preferences:${userId}`;
  }

  private normalizeStaffScope(scope?: string | null) {
    const normalized = scope?.trim().toUpperCase() ?? '';
    if (STAFF_SCOPE_OPTIONS.has(normalized)) {
      return normalized;
    }
    return 'AGENCY';
  }

  private async ensureHeadOfficeAgency() {
    const existing = await this.prisma.agency.findFirst({
      where: { name: HEAD_OFFICE_AGENCY_NAME },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.agency.create({
      data: {
        name: HEAD_OFFICE_AGENCY_NAME,
        status: 'ACTIVE',
        address: 'Head Office',
      },
      select: { id: true },
    });

    return created.id;
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

  private getRequiredVehiclePhotoCategories(vehicleType?: string | null) {
    if (!vehicleType) {
      return [] as string[];
    }

    if (TRUCK_VERIFICATION_TYPES.has(vehicleType)) {
      return [...TRUCK_PHOTO_CATEGORIES];
    }

    return [] as string[];
  }

  private isReviewPending(status?: string | null) {
    const normalized = String(status ?? '').trim().toUpperCase();
    return normalized === 'PENDING' || normalized === 'PENDING_REVIEW';
  }

  private getRequiredKycDocuments(role?: UserRole | string | null) {
    if (!role) {
      return ['NATIONAL_ID'];
    }

    return KYC_REQUIRED_DOCS[String(role)] ?? ['NATIONAL_ID'];
  }

  private formatDocumentLabel(type: string) {
    return type
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }

  private deriveReviewDrivenUserStatus(input: {
    currentStatus: AccountStatus;
    requiredDocuments: string[];
    documents: Array<{ type: string; status: string | null }>;
  }) {
    const approvedTypes = new Set(
      input.documents
        .filter((document) => String(document.status ?? '').toUpperCase() === 'APPROVED')
        .map((document) => document.type),
    );
    const hasRejectedDocument = input.documents.some(
      (document) => String(document.status ?? '').toUpperCase() === 'REJECTED',
    );

    if (input.currentStatus === AccountStatus.ACTIVE || input.currentStatus === AccountStatus.SUSPENDED) {
      return input.currentStatus;
    }

    if (
      input.requiredDocuments.length > 0 &&
      input.requiredDocuments.every((documentType) => approvedTypes.has(documentType))
    ) {
      return AccountStatus.ACTIVE;
    }

    if (hasRejectedDocument) {
      return AccountStatus.REJECTED;
    }

    return AccountStatus.PENDING;
  }

  private async refreshUserVerificationStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        kycDocuments: {
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const nextStatus = this.deriveReviewDrivenUserStatus({
      currentStatus: user.status,
      requiredDocuments: this.getRequiredKycDocuments(user.role),
      documents: user.kycDocuments,
    });

    if (nextStatus !== user.status) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: nextStatus },
      });
    }

    return nextStatus;
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

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id:        true,
          fullName:  true,
          companyName: true,
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

    const userIds = users.map((user) => user.id);
    const staffProfiles = userIds.length
      ? await this.prisma.staff.findMany({
          where: {
            userId: { in: userIds },
            isActive: true,
          },
          select: {
            userId: true,
            role: true,
            agency: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];

    const staffByUserId = new Map(
      staffProfiles.map((staff) => [
        staff.userId,
        {
          staffDepartment: staff.role,
          staffAgencyName: staff.agency?.name ?? null,
          staffScope:
            staff.agency?.name === HEAD_OFFICE_AGENCY_NAME ? 'HEAD_OFFICE' : 'AGENCY',
        },
      ]),
    );

    return {
      data: users.map((user) => ({
        ...user,
        staffDepartment: staffByUserId.get(user.id)?.staffDepartment ?? null,
        staffAgencyName: staffByUserId.get(user.id)?.staffAgencyName ?? null,
        staffScope: staffByUserId.get(user.id)?.staffScope ?? null,
      })),
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

  async createInternalUser(
    dto: CreateInternalUserDto,
    actorId: string,
    actorAgencyId?: string | null,
  ) {
    if (!INTERNAL_PROVISIONABLE_ROLES.has(dto.role)) {
      throw new BadRequestException('This role cannot be created from the internal user manager.');
    }

    if (ORGANIZATION_ACCOUNT_ROLES.has(dto.role) && !dto.companyName?.trim()) {
      throw new BadRequestException('Company name is required for this account type.');
    }

    let effectiveAgencyId = dto.agencyId ?? actorAgencyId ?? undefined;
    let normalizedStaffDepartment: string | null = null;
    let normalizedStaffScope: string | null = null;
    if (dto.role === UserRole.AGENCY_STAFF) {
      normalizedStaffDepartment = dto.staffRole?.trim().toUpperCase() ?? '';
      if (!STAFF_DEPARTMENT_OPTIONS.has(normalizedStaffDepartment)) {
        throw new BadRequestException('Staff department is required for internal staff accounts.');
      }

      normalizedStaffScope = this.normalizeStaffScope(dto.staffScope);
      if (normalizedStaffScope === 'HEAD_OFFICE') {
        effectiveAgencyId = await this.ensureHeadOfficeAgency();
      } else if (!effectiveAgencyId) {
        throw new BadRequestException('Agency is required when creating an agency staff account.');
      }
    }

    const normalizedEmail = dto.email?.trim().toLowerCase() || undefined;
    const normalizedPhone = dto.phone.trim();

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          normalizedEmail ? { email: normalizedEmail } : undefined,
          { phone: normalizedPhone },
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: { id: true },
    });
    if (existingUser) {
      throw new BadRequestException('A user with this email or phone already exists.');
    }

    if (effectiveAgencyId) {
      const agency = await this.prisma.agency.findUnique({
        where: { id: effectiveAgencyId },
        select: { id: true },
      });
      if (!agency) {
        throw new NotFoundException('Selected agency was not found.');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const targetStatus = dto.status ?? AccountStatus.ACTIVE;

    const created = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        companyName: dto.companyName?.trim() || null,
        email: normalizedEmail,
        phone: normalizedPhone,
        password: passwordHash,
        role: dto.role,
        status: targetStatus,
        agencyId: dto.role === UserRole.AGENCY_STAFF ? effectiveAgencyId : dto.agencyId ?? null,
        driverProfile:
          dto.role === UserRole.DRIVER
            ? {
                create: {},
              }
            : undefined,
      },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        agencyId: true,
      },
    });

    if (dto.role === UserRole.AGENCY_STAFF && effectiveAgencyId) {
      await this.prisma.staff.create({
        data: {
          userId: created.id,
          agencyId: effectiveAgencyId || undefined,
          role: normalizedStaffDepartment!,
          department: (normalizedStaffDepartment || 'OPERATIONS') as any,
          isActive: true,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'INTERNAL_USER_CREATED',
        entityType: 'USER',
        entityId: created.id,
        details: {
          role: created.role,
          status: created.status,
          agencyId: created.agencyId,
          staffDepartment: dto.role === UserRole.AGENCY_STAFF ? normalizedStaffDepartment : null,
          staffScope: dto.role === UserRole.AGENCY_STAFF ? normalizedStaffScope : null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message: 'User provisioned successfully.',
      data: created,
    };
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

  // PRD §4 — Upload KYC document and queue it for internal review
  // Schema field: `type` (not documentType)
  async uploadKycDocument(userId: string, file: MulterFile, dto: UploadKycDto) {
    await this.findOne(userId);

    if (!file) {
      throw new BadRequestException('KYC camera capture is required.');
    }
    if (dto.captureSource !== 'CAMERA') {
      throw new BadRequestException('KYC documents must be captured live using the camera.');
    }
    if (!dto.capturedAt || Number.isNaN(new Date(dto.capturedAt).getTime())) {
      throw new BadRequestException('KYC camera capture timestamp is required.');
    }
    if (!CAMERA_KYC_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('KYC upload must be a live camera image. Allowed: JPEG, PNG');
    }
    if (!this.hasAllowedImageSignature(file)) {
      throw new BadRequestException('Invalid KYC image content. Upload must be a valid JPEG or PNG image.');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: JPEG, PNG, PDF');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large. Maximum size is 5MB');
    }

    const safeName = file.originalname.replace(/\s+/g, '_');
    const relativePath = `kyc/${userId}/${dto.documentType}/${Date.now()}_${safeName}`;
    const fileUrl = await this.storageService.uploadFile(relativePath, file.buffer, file.mimetype);

    const reviewNote = [
      dto.notes?.trim() || null,
      `captureSource=${dto.captureSource}`,
      `capturedAt=${new Date(dto.capturedAt).toISOString()}`,
    ].filter(Boolean).join('\n');

    const normalizedSide = dto.documentSide?.trim().toUpperCase() || null;

    // Upsert: find an existing document of the same type (and side) for this user.
    // This prevents duplicate cards in the admin dashboard when a user re-uploads.
    const existingDoc = await this.prisma.kycDocument.findFirst({
      where: {
        userId,
        type: dto.documentType,
        ...(normalizedSide ? { documentSide: normalizedSide } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    let doc;
    if (existingDoc) {
      // Update the existing record — reset review status for re-review
      doc = await this.prisma.kycDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileUrl,
          documentNumber: dto.documentNumber?.trim() || existingDoc.documentNumber,
          issuingAuthority: dto.issuingAuthority?.trim() || existingDoc.issuingAuthority,
          countryOfIssue: dto.countryOfIssue?.trim().toUpperCase() || existingDoc.countryOfIssue,
          documentSide: normalizedSide ?? existingDoc.documentSide,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : existingDoc.issueDate,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : existingDoc.expiryDate,
          reviewNote,
          status: 'PENDING',
          rejectionReason: null,
          verifiedAt: null,
          verifiedBy: null,
        },
      });
    } else {
      doc = await this.prisma.kycDocument.create({
        data: {
          userId,
          type: dto.documentType,
          fileUrl,
          documentNumber: dto.documentNumber?.trim() || null,
          issuingAuthority: dto.issuingAuthority?.trim() || null,
          countryOfIssue: dto.countryOfIssue?.trim().toUpperCase() || null,
          documentSide: normalizedSide,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          reviewNote,
          status: 'PENDING',
        },
      });
    }

    // PRD §3 — New or replacement uploads return the account to the review queue.
    await this.prisma.user.update({
      where: { id: userId },
      data:  { status: AccountStatus.PENDING },
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

  async getMyVerificationSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        kycDocuments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            status: true,
            rejectionReason: true,
            reviewNote: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const requiredTypes = this.getRequiredKycDocuments(user.role);
    const latestByType = new Map<string, (typeof user.kycDocuments)[number]>();
    for (const document of user.kycDocuments) {
      if (!latestByType.has(document.type)) {
        latestByType.set(document.type, document);
      }
    }

    const requiredDocuments = requiredTypes.map((type) => {
      const document = latestByType.get(type);
      const status = String(document?.status ?? 'MISSING').toUpperCase();
      return {
        type,
        label: this.formatDocumentLabel(type),
        required: true,
        status,
        documentId: document?.id ?? null,
        rejectionReason: document?.rejectionReason ?? null,
        reviewNote: document?.reviewNote ?? null,
        uploadedAt: document?.createdAt ?? null,
        updatedAt: document?.updatedAt ?? null,
      };
    });

    const missingDocuments = requiredDocuments
      .filter((document) =>
        ['MISSING', 'REJECTED', 'RESUBMISSION_REQUIRED'].includes(document.status),
      )
      .map((document) => document.type);
    const approvedCount = requiredDocuments.filter((document) => document.status === 'APPROVED').length;
    const pendingCount = requiredDocuments.filter((document) => this.isReviewPending(document.status)).length;
    const rejectedCount = requiredDocuments.filter((document) =>
      ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(document.status),
    ).length;
    const uploadedCount = requiredDocuments.filter((document) => document.status !== 'MISSING').length;
    const allRequiredUploaded = missingDocuments.length === 0;

    return {
      role: user.role,
      status: user.status,
      requiredDocuments,
      missingDocuments,
      uploadedCount,
      approvedCount,
      pendingCount,
      rejectedCount,
      totalRequired: requiredDocuments.length,
      canSubmit: allRequiredUploaded && user.status !== AccountStatus.ACTIVE,
      nextStep:
        user.status === AccountStatus.ACTIVE
          ? 'DASHBOARD'
          : allRequiredUploaded
            ? 'SUBMIT_OR_WAIT_REVIEW'
            : 'COMPLETE_VERIFICATION',
    };
  }

  async submitKycForReview(userId: string) {
    const summary = await this.getMyVerificationSummary(userId);
    if (summary.missingDocuments.length > 0) {
      throw new BadRequestException({
        message: 'Upload all required KYC documents before submitting for review.',
        data: {
          missingDocuments: summary.missingDocuments,
        },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.PENDING },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'KYC_SUBMITTED_FOR_REVIEW',
        entityType: 'USER',
        entityId: userId,
        details: {
          role: summary.role,
          requiredDocuments: summary.requiredDocuments.map((document) => document.type),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message: 'KYC submitted for review.',
      data: await this.getMyVerificationSummary(userId),
    };
  }

  // PRD §4 — Admin review a KYC document and refresh the user's compliance status
  async verifyKycDocument(
    userId:     string,
    documentId: string,
    status:     'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED',
    reviewerId: string,
    note?:      string,
    reason?:    string,
  ) {
    const doc = await this.prisma.kycDocument.findFirst({
      where: { id: documentId, userId },
    });
    if (!doc) throw new NotFoundException('KYC document not found');

    const updated = await this.prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status,
        verifiedAt: new Date(),
        verifiedBy: reviewerId,
        reviewNote: note?.trim() || null,
        rejectionReason:
          status === 'APPROVED' ? null : reason?.trim() || 'Review feedback required',
      },
    });

    const nextStatus = await this.refreshUserVerificationStatus(userId);

    await this.prisma.auditLog.create({
      data: {
        userId: reviewerId,
        action: 'KYC_DOCUMENT_REVIEWED',
        entityType: 'KYC_DOCUMENT',
        entityId: documentId,
        details: {
          subjectUserId: userId,
          status,
          note: note?.trim() || null,
          reason: reason?.trim() || null,
          nextAccountStatus: nextStatus,
        } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async getVerificationDashboard() {
    const automationRun = await this.runComplianceAutomationScan();
    const now = new Date();
    const expiringThreshold = new Date(now);
    expiringThreshold.setDate(expiringThreshold.getDate() + EXPIRY_ALERT_DAYS);
    const reviewThreshold = new Date(now.getTime() - REVIEW_OVERDUE_HOURS * 60 * 60 * 1000);

    const [users, vehicles] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: { in: VERIFICATION_TARGET_ROLES },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          companyName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          kycDocuments: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              type: true,
              status: true,
              fileUrl: true,
              documentNumber: true,
              documentSide: true,
              expiryDate: true,
              reviewNote: true,
              rejectionReason: true,
              verifiedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.vehicle.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          plateNumber: true,
          type: true,
          status: true,
          verificationStatus: true,
          verificationReviewedAt: true,
          verificationReviewedBy: true,
          verificationNote: true,
          rejectionReason: true,
          createdAt: true,
          ownerUser: {
            select: {
              id: true,
              fullName: true,
              companyName: true,
              role: true,
              phone: true,
            },
          },
          driver: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
          verificationPhotos: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              photoType: true,
              photoUrl: true,
              status: true,
              timestamp: true,
              latitude: true,
              longitude: true,
              reviewedAt: true,
              reviewedBy: true,
              reviewNotes: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((user) => {
      const requiredDocuments = this.getRequiredKycDocuments(user.role);
      const approvedTypes = new Set(
        user.kycDocuments
          .filter((document) => String(document.status ?? '').toUpperCase() === 'APPROVED')
          .map((document) => document.type),
      );
      const pendingDocuments = user.kycDocuments.filter((document) =>
        this.isReviewPending(document.status),
      );

      return {
        ...user,
        requiredDocuments,
        missingDocuments: requiredDocuments.filter((documentType) => !approvedTypes.has(documentType)),
        pendingDocumentsCount: pendingDocuments.length,
      };
    });

    const formattedVehicles = vehicles.map((vehicle) => {
      const requiredPhotoCategories = this.getRequiredVehiclePhotoCategories(vehicle.type);
      const approvedCategories = new Set<string>(
        vehicle.verificationPhotos
          .filter((photo) => String(photo.status ?? '').toUpperCase() === 'APPROVED')
          .map((photo) => photo.photoType as string),
      );

      return {
        ...vehicle,
        requiredPhotoCategories,
        missingPhotoCategories: requiredPhotoCategories.filter(
          (category) => !approvedCategories.has(category),
        ),
      };
    });

    const expiringDocuments = formattedUsers.flatMap((user) =>
      user.kycDocuments
        .filter((document) => {
          const expiryDate = document.expiryDate ? new Date(document.expiryDate) : null;
          if (!expiryDate) {
            return false;
          }

          return (
            String(document.status ?? '').toUpperCase() === 'APPROVED' &&
            expiryDate > now &&
            expiryDate <= expiringThreshold
          );
        })
        .map((document) => ({
          userId: user.id,
          subjectLabel: user.fullName ?? user.companyName ?? user.phone ?? user.id,
          role: user.role,
          documentType: document.type,
          expiryDate: document.expiryDate,
        })),
    );

    const expiredDocuments = formattedUsers.flatMap((user) =>
      user.kycDocuments
        .filter((document) => String(document.status ?? '').toUpperCase() === 'EXPIRED')
        .map((document) => ({
          userId: user.id,
          subjectLabel: user.fullName ?? user.companyName ?? user.phone ?? user.id,
          role: user.role,
          documentType: document.type,
          expiryDate: document.expiryDate,
        })),
    );

    const overdueUserReviews = formattedUsers.flatMap((user) =>
      user.kycDocuments
        .filter((document) => {
          const createdAt = document.createdAt ? new Date(document.createdAt) : null;
          return Boolean(createdAt) && this.isReviewPending(document.status) && createdAt <= reviewThreshold;
        })
        .map((document) => ({
          userId: user.id,
          subjectLabel: user.fullName ?? user.companyName ?? user.phone ?? user.id,
          role: user.role,
          documentType: document.type,
          createdAt: document.createdAt,
        })),
    );

    const overdueVehicleReviews = formattedVehicles
      .filter((vehicle) => {
        const vehicleCreatedAt = vehicle.createdAt ? new Date(vehicle.createdAt) : null;
        const pendingVehicleReview =
          Boolean(vehicleCreatedAt) &&
          this.isReviewPending(vehicle.verificationStatus) &&
          vehicleCreatedAt <= reviewThreshold;
        const pendingPhotoReview = vehicle.verificationPhotos.some((photo) => {
          const createdAt = photo.createdAt ? new Date(photo.createdAt) : null;
          return Boolean(createdAt) && this.isReviewPending(photo.status) && createdAt <= reviewThreshold;
        });

        return pendingVehicleReview || pendingPhotoReview;
      })
      .map((vehicle) => ({
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        type: vehicle.type,
        ownerLabel:
          vehicle.ownerUser?.companyName ??
          vehicle.ownerUser?.fullName ??
          vehicle.driver?.user?.fullName ??
          vehicle.plateNumber,
      }));

    const vehiclesMissingPhotos = formattedVehicles
      .filter((vehicle) => vehicle.missingPhotoCategories.length > 0)
      .map((vehicle) => ({
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        type: vehicle.type,
        missingPhotoCategories: vehicle.missingPhotoCategories,
      }));

    const automationAlerts = [
      expiredDocuments.length > 0
        ? {
            severity: 'HIGH',
            title: `${expiredDocuments.length} expired compliance documents`,
            detail:
              'Operational roles tied to expired documents are automatically suspended until evidence is corrected.',
          }
        : null,
      expiringDocuments.length > 0
        ? {
            severity: 'MEDIUM',
            title: `${expiringDocuments.length} documents expiring within ${EXPIRY_ALERT_DAYS} days`,
            detail: 'Customer care and compliance teams should prompt resubmission before live operations are blocked.',
          }
        : null,
      overdueUserReviews.length > 0
        ? {
            severity: 'MEDIUM',
            title: `${overdueUserReviews.length} KYC reviews are overdue`,
            detail: `Pending compliance reviews older than ${REVIEW_OVERDUE_HOURS} hours need desk action.`,
          }
        : null,
      overdueVehicleReviews.length > 0
        ? {
            severity: 'MEDIUM',
            title: `${overdueVehicleReviews.length} vehicle reviews are overdue`,
            detail: 'Fleet verification is waiting on photo review or final approval beyond the SLA window.',
          }
        : null,
      vehiclesMissingPhotos.length > 0
        ? {
            severity: 'LOW',
            title: `${vehiclesMissingPhotos.length} vehicles are missing mandatory photo packs`,
            detail: 'Truck and container units cannot complete verification until the full photo evidence set is present.',
          }
        : null,
    ].filter(Boolean);

    return {
      summary: {
        usersAwaitingReview: formattedUsers.filter(
          (user) => user.pendingDocumentsCount > 0 || user.missingDocuments.length > 0,
        ).length,
        rejectedUsers: formattedUsers.filter((user) => user.status === AccountStatus.REJECTED).length,
        vehiclesAwaitingReview: formattedVehicles.filter(
          (vehicle) =>
            this.isReviewPending(vehicle.verificationStatus) ||
            vehicle.missingPhotoCategories.length > 0,
        ).length,
        rejectedVehicles: formattedVehicles.filter(
          (vehicle) => String(vehicle.verificationStatus).toUpperCase() === 'REJECTED',
        ).length,
        expiringDocuments: expiringDocuments.length,
        expiredDocuments: expiredDocuments.length,
        overdueUserReviews: overdueUserReviews.length,
        overdueVehicleReviews: overdueVehicleReviews.length,
        vehiclesMissingPhotos: vehiclesMissingPhotos.length,
        autoSuspendedUsers: automationRun.autoSuspendedUsers.length,
      },
      users: formattedUsers,
      vehicles: formattedVehicles,
      automation: {
        lastRunAt: automationRun.lastRunAt,
        autoSuspendedUsers: automationRun.autoSuspendedUsers,
        alerts: automationAlerts,
        expiringDocuments,
        expiredDocuments,
        overdueUserReviews,
        overdueVehicleReviews,
        vehiclesMissingPhotos,
      },
    };
  }

  // PRD §4 — Compliance: auto-suspend expired docs (drivers/transporters)
  private async runComplianceAutomationScan() {
    const now = new Date();
    const expiredDocs = await this.prisma.kycDocument.findMany({
      where: {
        expiryDate: { lte: now },
        status: { in: ['APPROVED', 'EXPIRED'] },
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            status: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    const autoSuspendedUsers: Array<{
      id: string;
      role: UserRole;
      subjectLabel: string;
    }> = [];

    for (const doc of expiredDocs) {
      if (String(doc.status ?? '').toUpperCase() !== 'EXPIRED') {
        await this.prisma.kycDocument.update({
          where: { id: doc.id },
          data: { status: 'EXPIRED' },
        });
      }

      if (
        COMPLIANCE_SUSPEND_ROLES.has(doc.user.role) &&
        doc.user.status !== AccountStatus.SUSPENDED
      ) {
        await this.prisma.user.update({
          where: { id: doc.user.id },
          data: { status: AccountStatus.SUSPENDED },
        });
        autoSuspendedUsers.push({
          id: doc.user.id,
          role: doc.user.role,
          subjectLabel:
            doc.user.fullName ??
            doc.user.companyName ??
            doc.user.phone ??
            doc.user.id,
        });
      }
    }

    return {
      lastRunAt: now.toISOString(),
      autoSuspendedUsers,
    };
  }

  async checkExpiringDocuments(): Promise<void> {
    await this.runComplianceAutomationScan();
    return;
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

  private hasAllowedImageSignature(file: MulterFile) {
    const header = file.buffer?.subarray(0, 8);
    if (!header || header.length < 4) {
      return false;
    }

    const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const isPng =
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a;

    return isJpeg || isPng;
  }
}
