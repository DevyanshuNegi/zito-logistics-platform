import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        channel: data.type || 'SYSTEM',
        status: 'PENDING',
      },
    });
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: 'READ' }, // Status can be 'READ' or whatever
    });
  }
}

