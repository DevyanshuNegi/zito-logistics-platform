import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    userId: string | null;
    action: string;
    oldValue?: any;
    newValue?: any;
    actingAs?: Role | string;
    viewAsUser?: string;
    ipAddress?: string;
    entityType?: string;
    entityId?: string;
  }) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId: data.userId || null,
          action: data.action,
          oldValue: data.oldValue || null,
          newValue: data.newValue || null,
          actingAs: (data.actingAs as Role) || Role.customer,
          viewAsUser: data.viewAsUser,
          ipAddress: data.ipAddress,
          entityType: data.entityType || 'SYSTEM',
          entityId: data.entityId || '0',
        },
      });
    } catch (error) {
      console.error('CRITICAL: Audit log failed to write:', error.message);
    }
  }
}