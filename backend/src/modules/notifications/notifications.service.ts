import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from './channels/email.service';
import { PushService } from './channels/push.service';
import { SmsService } from './channels/sms.service';

type Channel = 'SMS' | 'EMAIL' | 'PUSH' | 'WHATSAPP';

interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  channels?: Channel[];
  entityType?: string;
  entityId?: string;
  priority?: 'HIGH' | 'NORMAL';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly defaultChannels: Channel[] = ['SMS', 'EMAIL', 'PUSH'];
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
  ) {}

  async send(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; channel: Channel | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { phone: true, email: true, fullName: true },
    });

    if (!user) {
      this.logger.warn(`Notification skipped - user ${payload.userId} not found`);
      return { success: false, channel: null };
    }

    const channels = payload.channels ?? this.defaultChannels;

    for (const channel of channels) {
      const success = await this.sendViaChannel(channel, user, payload);
      await this.logNotification(payload, channel, success ? 'SENT' : 'FAILED');
      if (success) {
        return { success: true, channel };
      }
    }

    this.logger.error(`All notification channels failed for user ${payload.userId}`);
    return { success: false, channel: null };
  }

  async sendBulk(userIds: string[], payload: Omit<NotificationPayload, 'userId'>) {
    return Promise.allSettled(
      userIds.map((userId) => this.send({ ...payload, userId })),
    );
  }

  async sendSms(userId: string, data: Record<string, unknown>) {
    const template =
      typeof data.template === 'string' ? data.template : 'Zito notification';

    return this.send({
      userId,
      title: template.replace(/_/g, ' '),
      message: this.renderTemplateMessage(template, data),
      channels: ['SMS'],
      entityType: typeof data.entityType === 'string' ? data.entityType : 'SYSTEM',
      entityId: typeof data.entityId === 'string' ? data.entityId : userId,
    });
  }

  async notifyBookingCreated(customerId: string, bookingRef: string, bookingId: string) {
    return this.send({
      userId: customerId,
      title: 'Booking Created',
      message: `Your booking ${bookingRef} has been created and is awaiting assignment.`,
      channels: ['PUSH', 'EMAIL'],
      entityType: 'BOOKING',
      entityId: bookingId,
    });
  }

  async notifyDriverAssigned(
    customerId: string,
    driverUserId: string,
    bookingRef: string,
    bookingId: string,
  ) {
    await this.send({
      userId: customerId,
      title: 'Driver Assigned',
      message: `A driver has been assigned to booking ${bookingRef}. They are on their way.`,
      channels: ['PUSH', 'SMS'],
      entityType: 'BOOKING',
      entityId: bookingId,
    });

    await this.send({
      userId: driverUserId,
      title: 'New Trip Assigned',
      message: `You have been assigned booking ${bookingRef}. Accept within the time window.`,
      channels: ['PUSH', 'SMS'],
      entityType: 'BOOKING',
      entityId: bookingId,
    });
  }

  async notifyStatusChanged(
    customerId: string,
    bookingRef: string,
    status: string,
    bookingId: string,
  ) {
    const messages: Record<string, string> = {
      ACCEPTED: `Driver accepted your booking ${bookingRef} and is en route to pickup.`,
      ARRIVED: `Driver has arrived at your pickup location for booking ${bookingRef}.`,
      PICKED: `Your cargo has been collected for booking ${bookingRef}.`,
      IN_TRANSIT: `Your cargo is in transit for booking ${bookingRef}.`,
      ARRIVED_AT_DESTINATION: `Driver has arrived at the delivery location for booking ${bookingRef}.`,
      DELIVERED: `Your cargo has been delivered for booking ${bookingRef}. Please rate your experience.`,
      COMPLETED: `Booking ${bookingRef} is complete. Thank you for using Zito.`,
      CANCELLED: `Booking ${bookingRef} has been cancelled.`,
    };

    return this.send({
      userId: customerId,
      title: `Booking ${status}`,
      message: messages[status] ?? `Booking ${bookingRef} status updated to ${status}.`,
      channels: ['PUSH', 'SMS'],
      entityType: 'BOOKING',
      entityId: bookingId,
    });
  }

  async notifySOS(
    adminUserIds: string[],
    driverName: string,
    bookingId: string,
    lat: number,
    lng: number,
  ) {
    return this.sendBulk(adminUserIds, {
      title: 'SOS ALERT',
      message: `Driver ${driverName} triggered SOS. Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      channels: ['SMS', 'PUSH', 'EMAIL'],
      priority: 'HIGH',
      entityType: 'BOOKING',
      entityId: bookingId,
    });
  }

  async notifyDocumentExpiry(userId: string, documentName: string, daysRemaining: number) {
    const expired = daysRemaining <= 0;
    return this.send({
      userId,
      title: expired ? 'Document Expired' : 'Document Expiry Alert',
      message: expired
        ? `Your ${documentName} has expired. Renew immediately to continue receiving assignments.`
        : `Your ${documentName} expires in ${daysRemaining} days. Please renew to avoid suspension.`,
      channels: ['SMS', 'EMAIL'],
      entityType: 'COMPLIANCE',
      entityId: userId,
    });
  }

  private async sendViaChannel(
    channel: Channel,
    user: { phone: string | null; email: string | null; fullName: string | null },
    payload: NotificationPayload,
  ) {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        switch (channel) {
          case 'SMS':
            return await this.smsService.send(user.phone ?? '', payload.message);
          case 'EMAIL':
            return await this.emailService.send(
              user.email ?? '',
              payload.title,
              payload.message,
            );
          case 'PUSH':
            return await this.pushService.send(
              payload.userId,
              payload.title,
              payload.message,
            );
          case 'WHATSAPP':
          default:
            return false;
        }
      } catch (error) {
        attempt += 1;
        this.logger.warn(
          `[${channel}] Attempt ${attempt} failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * attempt);
        }
      }
    }
    return false;
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      return null;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: result.count };
  }

  private async logNotification(
    payload: NotificationPayload,
    channel: Channel,
    status: string,
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          title: payload.title,
          message: payload.message.slice(0, 500),
          channel,
          status,
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
        },
      });
    } catch {
      // Notification logging must never crash the main flow.
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private renderTemplateMessage(template: string, data: Record<string, unknown>) {
    const parts = Object.entries(data)
      .filter(([key, value]) => key !== 'template' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${String(value)}`);

    return parts.length > 0 ? `${template.replace(/_/g, ' ')} - ${parts.join(', ')}` : template;
  }
}
