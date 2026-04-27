import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async createStaff(agencyId: string, dto: {
    userId: string;
    role: string;
  }, createdByAdminId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException('Agency not found');

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.staff.findFirst({
      where: { userId: dto.userId, agencyId },
    });
    if (existing) throw new ConflictException('User is already staff at this agency');

    const staff = await this.prisma.staff.create({
      data: {
        userId: dto.userId,
        agencyId,
        role: dto.role,
        isActive: true,
      },
    });

    await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        role: UserRole.AGENCY_STAFF,
      },
    });

    return staff;
  }

  async listStaff(agencyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [staff, total] = await Promise.all([
      this.prisma.staff.findMany({
        where: { agencyId, isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.staff.count({ where: { agencyId, isActive: true } }),
    ]);

    return { staff, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getStaff(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        agency: { select: { id: true, name: true } },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async updateStaff(staffId: string, dto: {
    role?: string;
    isActive?: boolean;
  }, updatedByAdminId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.prisma.staff.update({
      where: { id: staffId },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async removeStaff(staffId: string, removedByAdminId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    await this.prisma.staff.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    return { message: 'Staff member deactivated successfully' };
  }

  async verifyStaffAccess(userId: string, agencyId: string): Promise<boolean> {
    const staff = await this.prisma.staff.findFirst({
      where: { userId, agencyId, isActive: true },
    });
    return !!staff;
  }
}
