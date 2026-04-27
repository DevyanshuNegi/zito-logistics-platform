import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export enum NotificationChannel {
  SMS   = 'SMS',
  EMAIL = 'EMAIL',
  PUSH  = 'PUSH',
}

export interface SendNotificationOptions {
  userId: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Send Notification (PRD §22) ─────────────────────────────────────────
  /**
   * Creates a notification record and dispatches via the correct channel.
   * PRD §22: Retry + fallback — SMS fail → Email → Push.
   */
  async send(opts: SendNotificationOptions): Promise<void> {
    // Persist notification record first
    const notification = await this.prisma.notification.create({
      data: {
        userId: opts.userId,
        title: opts.title,
        message: opts.message,
        channel: opts.channel,
        status: 'PENDING',
        entityType: opts.entityType,
        entityId: opts.entityId,
      },
    });

    try {
      await this.dispatch(opts.channel, opts, notification.id);
    } catch (err) {
      this.logger.warn(
        `${opts.channel} delivery failed for notification ${notification.id}: ${err.message}. Attempting fallback.`,
      );
      await this.fallback(opts, notification.id);
    }
  }

  // ─── Multi-channel Dispatch ───────────────────────────────────────────────
  private async dispatch(
    channel: NotificationChannel,
    opts: SendNotificationOptions,
    notificationId: string,
  ): Promise<void> {
    switch (channel) {
      case NotificationChannel.SMS:
        await this.sendSms(opts);
        break;
      case NotificationChannel.EMAIL:
        await this.sendEmail(opts);
        break;
      case NotificationChannel.PUSH:
        await this.sendPush(opts);
        break;
    }

    // Mark as sent
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'SENT' },
    });
  }

  // ─── Fallback Chain (PRD §22) ────────────────────────────────────────────
  /**
   * PRD §22: SMS fail → Email → Push
   */
  private async fallback(opts: SendNotificationOptions, notificationId: string): Promise<void> {
    const fallbackOrder: NotificationChannel[] = [
      NotificationChannel.EMAIL,
      NotificationChannel.PUSH,
    ];

    for (const channel of fallbackOrder) {
      try {
        await this.dispatch(channel, { ...opts, channel }, notificationId);
        this.logger.log(`Fallback succeeded via ${channel} for notification ${notificationId}`);
        return;
      } catch {
        this.logger.warn(`Fallback via ${channel} also failed for notification ${notificationId}`);
      }
    }

    // All channels failed — mark as FAILED and increment retry count
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'FAILED', retryCount: { increment: 1 } },
    });
    this.logger.error(`All channels failed for notification ${notificationId}`);
  }

  // ─── SMS (Africa's Talking — Phase 2) ────────────────────────────────────
  private async sendSms(opts: SendNotificationOptions): Promise<void> {
    // Phase 1 stub — Africa's Talking integration added in Phase 2
    // TODO Phase 2: Replace with AT SDK call
    // const at = require('africastalking')({ apiKey, username });
    // await at.SMS.send({ to: [phone], message: opts.message, from: 'ZITO' });
    this.logger.log(`[SMS STUB] To user ${opts.userId}: ${opts.title}`);
  }

  // ─── Email (Resend — already configured in auth) ─────────────────────────
  private async sendEmail(opts: SendNotificationOptions): Promise<void> {
    // Phase 1: Log only — Resend email sending wired in Phase 2
    // TODO Phase 2: Use Resend SDK to send transactional email
    // await resend.emails.send({ from, to, subject: opts.title, html: opts.message });
    this.logger.log(`[EMAIL STUB] To user ${opts.userId}: ${opts.title}`);
  }

  // ─── Push (Firebase FCM — Phase 2) ───────────────────────────────────────
  private async sendPush(opts: SendNotificationOptions): Promise<void> {
    // Phase 1 stub — FCM integration added in Phase 2
    // TODO Phase 2: Use firebase-admin to send FCM push
    // await admin.messaging().send({ token: deviceToken, notification: { title, body } });
    this.logger.log(`[PUSH STUB] To user ${opts.userId}: ${opts.title}`);
  }

  // ─── Booking Event Triggers (PRD §22) ────────────────────────────────────
  /**
   * PRD §22: All key booking events trigger notifications.
   * Called by BookingsService at each status transition.
   */
  async notifyBookingCreated(customerId: string, bookingRef: string) {
    await this.send({
      userId: customerId,
      title: 'Booking Received',
      message: `Your booking ${bookingRef} has been received and is pending review.`,
      channel: NotificationChannel.EMAIL,
      entityType: 'booking',
    });
  }

  async notifyDriverAssigned(customerId: string, driverId: string, bookingRef: string) {
    await Promise.all([
      this.send({
        userId: customerId,
        title: 'Driver Assigned',
        message: `A driver has been assigned to your booking ${bookingRef}. They are on the way.`,
        channel: NotificationChannel.SMS,
        entityType: 'booking',
      }),
      this.send({
        userId: driverId,
        title: 'New Trip Assigned',
        message: `You have been assigned booking ${bookingRef}. Please accept or reject within 5 minutes.`,
        channel: NotificationChannel.PUSH,
        entityType: 'booking',
      }),
    ]);
  }

  async notifyDelivered(customerId: string, bookingRef: string) {
    await this.send({
      userId: customerId,
      title: 'Cargo Delivered',
      message: `Your cargo for booking ${bookingRef} has been delivered successfully.`,
      channel: NotificationChannel.SMS,
      entityType: 'booking',
    });
  }

  async notifyBookingCancelled(customerId: string, driverId: string | null, bookingRef: string) {
    const promises = [
      this.send({
        userId: customerId,
        title: 'Booking Cancelled',
        message: `Booking ${bookingRef} has been cancelled.`,
        channel: NotificationChannel.EMAIL,
        entityType: 'booking',
      }),
    ];

    if (driverId) {
      promises.push(
        this.send({
          userId: driverId,
          title: 'Trip Cancelled',
          message: `Booking ${bookingRef} has been cancelled by the customer.`,
          channel: NotificationChannel.PUSH,
          entityType: 'booking',
        }),
      );
    }

    await Promise.all(promises);
  }

  async notifyPaymentConfirmed(customerId: string, bookingRef: string) {
    await this.send({
      userId: customerId,
      title: 'Payment Confirmed',
      message: `Payment for booking ${bookingRef} has been confirmed. Invoice will be sent shortly.`,
      channel: NotificationChannel.EMAIL,
      entityType: 'booking',
    });
  }

  // ─── User Notifications CRUD ─────────────────────────────────────────────

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });

    return { notifications, total, unreadCount, page, limit };
  }

  async markAsRead(id: string, userId: string) {
    // Ensure user owns this notification
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) return null;

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}