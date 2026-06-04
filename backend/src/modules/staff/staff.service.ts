import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

// Schema reality:
// Staff fields: id, userId (unique), agencyId, role (String), isActive
// Staff has NO user relation — fetch user separately when needed
// Staff has NO permissions field
// User.role is singular UserRole — NOT roles[]

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async createStaff(
    agencyId: string,
    dto: { userId: string; role: string },
    adminId?: string,
  ) {
    // Verify agency exists
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException('Agency not found');

    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');

    // Check not already staff at this agency
    const existing = await this.prisma.staff.findFirst({
      where: { userId: dto.userId, agencyId },
    });
    if (existing) throw new ConflictException('User is already staff at this agency');

    const staff = await this.prisma.staff.create({
      data: {
        userId: dto.userId,
        agencyId: agencyId || undefined,
        role: dto.role,
        department: 'OPERATIONS', // Default department; can be customized via DTO later
        isActive: true,
      },
    });

    // Update user's role to AGENCY_STAFF
    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { role: UserRole.AGENCY_STAFF },
    });

    if (adminId) {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'STAFF_CREATED',
          entityType: 'STAFF',
          entityId: staff.id,
          details: {
            agencyId,
            userId: dto.userId,
            role: dto.role,
          },
        },
      });
    }

    // Return staff with user data joined manually
    return {
      ...staff,
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone },
    };
  }

  async listStaff(agencyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [staffList, total] = await Promise.all([
      this.prisma.staff.findMany({
        where: { agencyId, isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.staff.count({ where: { agencyId, isActive: true } }),
    ]);

    // Enrich with user data
    const userIds = staffList.map((s) => s.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true, phone: true, status: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return {
      staff: staffList.map((s) => ({ ...s, user: userMap[s.userId] ?? null })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getStaff(staffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const user = await this.prisma.user.findUnique({
      where: { id: staff.userId },
      select: { id: true, fullName: true, email: true, phone: true, status: true },
    });

    const agency = await this.prisma.agency.findUnique({
      where: { id: staff.agencyId },
      select: { id: true, name: true },
    });

    return { ...staff, user, agency };
  }

  async updateStaff(staffId: string, dto: { role?: string; isActive?: boolean }) {
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

  async removeStaff(staffId: string) {
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
