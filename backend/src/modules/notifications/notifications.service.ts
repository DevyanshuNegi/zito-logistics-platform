import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// PRD §22 — Notification retry + fallback
// Channel priority: SMS → Email → Push → WhatsApp
// Failed channel → retry → next channel
// All failures logged

type Channel = 'SMS' | 'EMAIL' | 'PUSH' | 'WHATSAPP';

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  channels?: Channel[];  // override channel order if needed
  bookingId?: string;
  priority?: 'HIGH' | 'NORMAL';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly DEFAULT_CHANNEL_ORDER: Channel[] = ['SMS', 'EMAIL', 'PUSH', 'WHATSAPP'];
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(private readonly prisma: PrismaService) {}

  // Main dispatch: tries each channel in order until one succeeds
  async send(payload: NotificationPayload): Promise<{ success: boolean; channel: Channel | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { phone: true, email: true, fullName: true },
    });

    if (!user) {
      this.logger.warn(`Notification skipped — user ${payload.userId} not found`);
      return { success: false, channel: null };
    }

    const channels = payload.channels ?? this.DEFAULT_CHANNEL_ORDER;

    for (const channel of channels) {
      const success = await this.sendViaChannel(channel, user, payload);
      if (success) {
        await this.logNotification(payload, channel, 'SUCCESS');
        return { success: true, channel };
      }
      await this.logNotification(payload, channel, 'FAILED');
    }

    this.logger.error(`All notification channels failed for user ${payload.userId}`);
    return { success: false, channel: null };
  }

  // Send to multiple users (e.g. admin broadcast)
  async sendBulk(userIds: string[], payload: Omit<NotificationPayload, 'userId'>) {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.send({ ...payload, userId })),
    );
    return results;
  }

  private async sendViaChannel(
    channel: Channel,
    user: { phone: string; email: string; fullName: string },
    payload: NotificationPayload,
  ): Promise<boolean> {
    let attempt = 0;
    while (attempt < this.MAX_RETRIES) {
      try {
        switch (channel) {
          case 'SMS':
            return await this.sendSms(user.phone, payload.body);
          case 'EMAIL':
            return await this.sendEmail(user.email, payload.title, payload.body);
          case 'PUSH':
            return await this.sendPush(payload.userId, payload.title, payload.body, payload.data);
          case 'WHATSAPP':
            return await this.sendWhatsApp(user.phone, payload.body);
        }
      } catch (err) {
        attempt++;
        this.logger.warn(`[${channel}] Attempt ${attempt} failed for user ${payload.userId}: ${err.message}`);
        if (attempt < this.MAX_RETRIES) {
          await this.sleep(this.RETRY_DELAY_MS * attempt); // exponential backoff
        }
      }
    }
    return false;
  }

  private async sendSms(phone: string, message: string): Promise<boolean> {
    if (!phone) return false;
    // Africa's Talking SMS integration
    // In Phase 1: stub until AT API key is provisioned
    if (process.env.AT_API_KEY) {
      // const AT = require('africastalking')({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });
      // await AT.SMS.send({ to: [phone], message, from: process.env.AT_SENDER_ID });
    }
    this.logger.debug(`[SMS] → ${phone}: ${message.slice(0, 60)}...`);
    return true; // stub returns true in dev
  }

  private async sendEmail(email: string, subject: string, body: string): Promise<boolean> {
    if (!email) return false;
    // Resend / SendGrid integration
    if (process.env.RESEND_API_KEY) {
      // const { Resend } = require('resend');
      // const resend = new Resend(process.env.RESEND_API_KEY);
      // await resend.emails.send({ from: 'noreply@zito.co.ke', to: email, subject, html: body });
    }
    this.logger.debug(`[EMAIL] → ${email}: ${subject}`);
    return true;
  }

  private async sendPush(userId: string, title: string, body: string, data?: Record<string, any>): Promise<boolean> {
    // Firebase FCM push notification
    // Requires device token stored per user in DB
    if (process.env.FCM_SERVER_KEY) {
      // const token = await this.getDeviceToken(userId);
      // if (!token) return false;
      // await admin.messaging().send({ token, notification: { title, body }, data });
    }
    this.logger.debug(`[PUSH] → userId:${userId}: ${title}`);
    return true;
  }

  private async sendWhatsApp(phone: string, message: string): Promise<boolean> {
    if (!phone) return false;
    // WhatsApp Business API — Phase 2
    this.logger.debug(`[WHATSAPP] → ${phone}: ${message.slice(0, 60)}...`);
    return false; // not available in Phase 1 — causes fallback to fail gracefully
  }

  private async logNotification(
    payload: NotificationPayload,
    channel: Channel,
    status: 'SUCCESS' | 'FAILED',
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          channel,
          title: payload.title,
          message: payload.body.slice(0, 500),
          status,
          entityType: 'BOOKING',
          entityId: payload.bookingId,
          createdAt: new Date(),
        },
      });
    } catch {
      // Never let notification logging break the flow
    }
  }

  // ── User notification management ────────────────────────────────────────

  async getUserNotifications(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId }, // Ensure user owns the notification
    });
    
    if (!notification) {
      throw new Error('Notification not found or unauthorized');
    }

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

  // ── Typed event dispatchers ─────────────────────────────────────────────

  async notifyBookingCreated(customerId: string, bookingRef: string, bookingId: string) {
    return this.send({
      userId: customerId,
      title: 'Booking Created',
      body: `Your booking ${bookingRef} has been created and is pending assignment.`,
      bookingId,
      channels: ['PUSH', 'EMAIL'],
    });
  }

  async notifyDriverAssigned(customerId: string, driverId: string, bookingRef: string, bookingId: string) {
    await this.send({
      userId: customerId,
      title: 'Driver Assigned',
      body: `A driver has been assigned to your booking ${bookingRef}. They are on their way.`,
      bookingId,
      channels: ['PUSH', 'SMS'],
    });
    await this.send({
      userId: driverId,
      title: 'New Trip Assigned',
      body: `You have been assigned booking ${bookingRef}. Please accept within the allocated time.`,
      bookingId,
      channels: ['PUSH', 'SMS'],
    });
  }

  async notifyDelivered(customerId: string, bookingRef: string, bookingId: string) {
    return this.send({
      userId: customerId,
      title: 'Cargo Delivered',
      body: `Your cargo from booking ${bookingRef} has been delivered. Please rate your experience.`,
      bookingId,
      channels: ['PUSH', 'SMS', 'EMAIL'],
    });
  }

  async notifySOSTrigger(adminIds: string[], driverName: string, bookingId: string, location: { lat: number; lng: number }) {
    return this.sendBulk(adminIds, {
      title: '🚨 SOS ALERT',
      body: `Driver ${driverName} has triggered an SOS emergency. Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
      bookingId,
      priority: 'HIGH',
      channels: ['SMS', 'PUSH', 'EMAIL'],
    });
  }

  async notifyDocumentExpiry(userId: string, documentName: string, daysRemaining: number) {
    return this.send({
      userId,
      title: 'Document Expiry Alert',
      body: `Your ${documentName} ${daysRemaining <= 0 ? 'has expired' : `expires in ${daysRemaining} days`}. Please renew to continue receiving assignments.`,
      channels: ['SMS', 'EMAIL'],
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}