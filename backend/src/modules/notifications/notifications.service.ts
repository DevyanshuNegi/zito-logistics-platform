import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async send(data: any) {
    // Scaffold real integrations (Africa's Talking, SendGrid, FCM)
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title || 'Notification',
        message: data.message,
        type: data.type || 'SYSTEM',
        isRead: false,
      },
    });
  }

  async getUnread(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
  }
}
