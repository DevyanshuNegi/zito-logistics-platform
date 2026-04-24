import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(query: any) {
    const { role, status, skip = 0, take = 10 } = query;

    const where: any = { deletedAt: null };
    if (role) where.roles = { has: role };
    if (status) where.complianceStatus = status;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        select: {
          id: true,
          email: true,
          full_name: true,
          roles: true,
          complianceStatus: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: users,
      meta: { total, skip: Number(skip), take: Number(take) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        phone: true,
        full_name: true,
        roles: true,
        idNumber: true,
        complianceStatus: true,
        dataLocked: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return { success: true, data: user };
  }

  async create(data: any, performingUser?: any) {
    const tempPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        ...data,
        passwordHash,
        complianceStatus: 'pending',
        isActive: false,
      },
    });

    const { passwordHash: _, ...result } = user;

    await this.audit.log({
      userId: performingUser?.userId,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      newValue: { roles: (user as any).roles },
      actingAs: performingUser?.roles?.[0],
    });

    return {
      success: true,
      message: 'User created successfully',
      data: result,
    };
  }

  async update(id: string, data: any, performingUser?: any) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('User not found');

    const isAdmin = performingUser?.roles?.some((r: any) =>
      ['super_admin', 'operations_admin', 'finance_admin'].includes(r),
    );

    if (existing.dataLocked && !isAdmin) {
      delete data.roles;
      delete data.idNumber;
      delete data.full_name;
    }

    if (!isAdmin) {
      delete data.complianceStatus;
      delete data.isActive;
      delete data.deletedAt;
      delete data.passwordHash;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    await this.audit.log({
      userId: performingUser?.userId,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      oldValue: existing,
      newValue: data,
      actingAs: performingUser?.roles?.[0],
    });

    const { passwordHash: _, ...result } = user;
    return { success: true, data: result };
  }

  async toggleLock(id: string, lock: boolean, performingUser?: any) {
    await this.prisma.user.update({
      where: { id },
      data: { dataLocked: lock },
    });

    await this.audit.log({
      userId: performingUser?.userId,
      action: lock ? 'USER_LOCKED' : 'USER_UNLOCKED',
      entityType: 'USER',
      entityId: id,
      newValue: { dataLocked: lock },
      actingAs: performingUser?.roles?.[0],
    });

    return {
      success: true,
      message: `User data ${lock ? 'locked' : 'unlocked'}`,
    };
  }

  ensureActiveUser(user: any) {
    if (!user.isActive || user.complianceStatus !== 'active') {
      throw new ForbiddenException('User not active');
    }
  }
}