import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, AccountStatus } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
export class UploadKycDto {
  documentType: string;
}

// PRD §4 — Inline Multer file type (avoids @types/multer dependency)
interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// PRD §42 — Filter options for admin user listing
interface FindAllOptions {
  page: number;
  limit: number;
  role?: UserRole;
  status?: string;
  agencyId?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ─── FIND ONE ─────────────────────────────────────────────────────────────

  // PRD §4 — Get user profile and account status
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id:        true,
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

  // PRD §42 — Admin list users with pagination, role, status, agency filters
  async findAll({ page, limit, role, status, agencyId }: FindAllOptions) {
    const skip = (page - 1) * limit;

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
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  // ─── UPDATE PROFILE ───────────────────────────────────────────────────────

  // PRD §4 — Update own profile (name, email, phone — locked: role, status)
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // ensure exists
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email && { email: dto.email.toLowerCase().trim() }),
        ...(dto.phone && { phone: dto.phone.trim() }),
      },
    });
  }

  // ─── ROLE ─────────────────────────────────────────────────────────────────

  // PRD §2 — SUPER_ADMIN only: change a user's role
  async updateRole(id: string, role: UserRole) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  // ─── STATUS ───────────────────────────────────────────────────────────────

  // PRD §3 — Account lifecycle: ACTIVE, SUSPENDED, REJECTED, PENDING
  async setStatus(id: string, status: AccountStatus) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  // ─── KYC ──────────────────────────────────────────────────────────────────

  // PRD §4 — Upload KYC document; sets compliance status to PENDING
  async uploadKycDocument(userId: string, file: MulterFile, dto: UploadKycDto) {
    await this.findOne(userId);

    // PRD §4 — Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new ForbiddenException('Invalid file type. Allowed: JPEG, PNG, PDF');
    }

    // PRD §4 — Max file size: 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new ForbiddenException('File too large. Maximum size is 5MB');
    }

    // Store file reference — actual upload to S3/cloud handled by storage service
    const fileUrl = `kyc/${userId}/${dto.documentType}/${Date.now()}_${file.originalname}`;

    return this.prisma.kycDocument.create({
      data: {
        userId,
        type: dto.documentType,
        fileUrl,
        status:       'PENDING',
      },
    });
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

    const updated = await this.prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status,
        verifiedAt: status === 'APPROVED' ? new Date() : null,
      },
    });

    // PRD §3 — If all docs approved, activate user account
    if (status === 'APPROVED') {
      const pendingDocs = await this.prisma.kycDocument.count({
        where: { userId, status: { not: 'APPROVED' } },
      });
      if (pendingDocs === 0) {
        await this.setStatus(userId, AccountStatus.ACTIVE);
      }
    }

    return updated;
  }
}