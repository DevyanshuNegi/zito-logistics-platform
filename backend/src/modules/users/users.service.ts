import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { role, status, skip = 0, take = 10 } = query;
    
    const where: any = {};
    if (role) where.role = role;
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
          role: true,
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        full_name: true,
        role: true,
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

  async create(data: any) {
    // Generate simple default password hash for admin-created users
    const passwordHash = await bcrypt.hash('Standard@123', 10);
    
    const user = await this.prisma.user.create({
      data: {
        ...data,
        passwordHash,
      },
    });

    // Remove hash from response
    const { passwordHash: _, ...result } = user;
    
    return {
      success: true,
      message: 'User created successfully',
      data: result,
    };
  }

  async update(id: string, data: any) {
    // Check if user is locked before updating critical fields
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    
    if (existing.dataLocked) {
      // Prevent updates to specific fields if locked
      delete data.role;
      delete data.idNumber;
      delete data.full_name;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    const { passwordHash: _, ...result } = user;
    return { success: true, data: result };
  }

  async toggleLock(id: string, lock: boolean) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { dataLocked: lock },
    });
    return { success: true, message: `User data ${lock ? 'locked' : 'unlocked'}` };
  }
}