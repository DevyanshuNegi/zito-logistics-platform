import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Schema reality:
// Notification fields: id, userId, title, message, channel, status, retryCount, readAt, entityType, entityId
// NO bookingId field — use entityId/entityType instead
// Model is prisma.notification (NOT notificationLog)

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
  private readonly DEFAULT_CHANNELS: Channel[] = ['SMS', 'EMAIL', 'PUSH'];
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(private readonly prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<{ success: boolean; channel: Channel | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { phone: true, email: true, fullName: true },
    });
    if (!user) {
      this.logger.warn(`Notification skipped — user ${payload.userId} not found`);
      return { success: false, channel: null };
    }

    const channels = payload.channels ?? this.DEFAULT_CHANNELS;

    for (const channel of channels) {
      const success = await this.sendViaChannel(channel, user, payload);
      if (success) {
        await this.logNotification(payload, channel, 'SENT');
        return { success: true, channel };
      }
      await this.logNotification(payload, channel, 'FAILED');
    }

    this.logger.error(`All notification channels failed for user ${payload.userId}`);
    return { success: false, channel: null };
  }

  async sendBulk(userIds: string[], payload: Omit<NotificationPayload, 'userId'>) {
    return Promise.allSettled(userIds.map((uid) => this.send({ ...payload, userId: uid })));
  }

  // ── Typed event dispatchers ──────────────────────────────────────────────

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

  async notifyDriverAssigned(customerId: string, driverUserId: string, bookingRef: string, bookingId: string) {
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

  async notifyStatusChanged(customerId: string, bookingRef: string, status: string, bookingId: string) {
    const messages: Record<string, string> = {
      ACCEPTED:               `Driver accepted your booking ${bookingRef} and is en route to pickup.`,
      ARRIVED:                `Driver has arrived at your pickup location for booking ${bookingRef}.`,
      PICKED:                 `Your cargo has been collected for booking ${bookingRef}.`,
      IN_TRANSIT:             `Your cargo is in transit for booking ${bookingRef}.`,
      ARRIVED_AT_DESTINATION: `Driver has arrived at the delivery location for booking ${bookingRef}.`,
      DELIVERED:              `Your cargo has been delivered for booking ${bookingRef}. Please rate your experience.`,
      COMPLETED:              `Booking ${bookingRef} is complete. Thank you for using ZITO.`,
      CANCELLED:              `Booking ${bookingRef} has been cancelled.`,
    };
    const message = messages[status] ?? `Booking ${bookingRef} status updated to ${status}.`;
    return this.send({
      userId: customerId,
      title: `Booking ${status}`,
      message,
      channels: ['PUSH', 'SMS'],
      entityType: 'BOOKING',
      entityId: bookingId,
    });
  }

  async notifySOS(adminUserIds: string[], driverName: string, bookingId: string, lat: number, lng: number) {
    return this.sendBulk(adminUserIds, {
      title: '🚨 SOS ALERT',
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

  // ── Channel dispatchers ──────────────────────────────────────────────────

  private async sendViaChannel(
    channel: Channel,
    user: { phone: string; email: string; fullName: string },
    payload: NotificationPayload,
  ): Promise<boolean> {
    let attempt = 0;
    while (attempt < this.MAX_RETRIES) {
      try {
        switch (channel) {
          case 'SMS':    return await this.sendSms(user.phone, payload.message);
          case 'EMAIL':  return await this.sendEmail(user.email, payload.title, payload.message);
          case 'PUSH':   return await this.sendPush(payload.userId, payload.title, payload.message);
          case 'WHATSAPP': return false; // Phase 2
        }
      } catch (err) {
        attempt++;
        this.logger.warn(`[${channel}] Attempt ${attempt} failed: ${err.message}`);
        if (attempt < this.MAX_RETRIES) {
          await this.sleep(this.RETRY_DELAY_MS * attempt);
        }
      }
    }
    return false;
  }

  private async sendSms(phone: string, message: string): Promise<boolean> {
    if (!phone) return false;
    if (process.env.AT_API_KEY) {
      // Africa's Talking — wire in Phase 2
    }
    this.logger.debug(`[SMS] → ${phone}: ${message.slice(0, 80)}`);
    return true;
  }

  private async sendEmail(email: string, subject: string, body: string): Promise<boolean> {
    if (!email) return false;
    if (process.env.RESEND_API_KEY) {
      // Resend — wire in Phase 2
    }
    this.logger.debug(`[EMAIL] → ${email}: ${subject}`);
    return true;
  }

  private async sendPush(userId: string, title: string, body: string): Promise<boolean> {
    if (process.env.FCM_SERVER_KEY) {
      // Firebase FCM — wire in Phase 2
    }
    this.logger.debug(`[PUSH] → ${userId}: ${title}`);
    return true;
  }

  private async logNotification(payload: NotificationPayload, channel: Channel, status: string) {
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
      // Never crash main flow on log failure
    }
  }

  // ── User-facing notification queries ────────────────────────────────────

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ) {
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
    return { notifications, total, unreadCount, page, limit, pages: Math.ceil(total / limit) };
  }

  async markAsRead(notificationId: string, userId: string) {
    // Verify ownership before marking
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) return null;

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

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}