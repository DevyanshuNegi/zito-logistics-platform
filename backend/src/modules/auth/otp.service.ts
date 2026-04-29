import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

// Schema models used:
// LoginOtp:     id, contact, otp, expiresAt, resendCount, createdAt
// LoginAttempt: identifier(PK String), count, lastAttemptAt, lockExpiresAt

// PRD §3 rules:
// - OTP valid 5 minutes
// - Resend cooldown 30 seconds
// - Max 5 resends per day
// - Max 5 verify attempts → account lock
// - OTP hashed in DB (SHA-256)
// - Single-use only

const OTP_TTL_MS       = 5 * 60 * 1000;       // 5 minutes
const COOLDOWN_SECS    = 30;
const MAX_RESENDS      = 5;
const MAX_VERIFY_TRIES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;      // 15 minute lock on breach

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Send OTP ─────────────────────────────────────────────────────────────

  async sendOtp(
    contact: string,
    purpose: string,
  ): Promise<{ sent: boolean; cooldownRemaining?: number }> {

    // Check for recent unexpired OTP — enforce cooldown
    const recent = await this.prisma.loginOtp.findFirst({
      where: {
        contact,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;

      // Within cooldown window
      if (secondsSince < COOLDOWN_SECS) {
        const remaining = Math.ceil(COOLDOWN_SECS - secondsSince);
        return { sent: false, cooldownRemaining: remaining };
      }

      // Enforce max daily resends
      if (recent.resendCount >= MAX_RESENDS) {
        throw new HttpException(
          `Maximum OTP requests (${MAX_RESENDS}) reached. Try again tomorrow.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Invalidate old OTP by expiring it now
      await this.prisma.loginOtp.update({
        where: { id: recent.id },
        data: { expiresAt: new Date() },
      });
    }

    // Generate 6-digit OTP
    const plainOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = this.hash(plainOtp);
    const resendCount = recent ? recent.resendCount + 1 : 0;

    await this.prisma.loginOtp.create({
      data: {
        contact,
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        resendCount,
      },
    });

    // Dispatch
    await this.dispatch(contact, plainOtp, purpose);

    return { sent: true };
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────

  async verifyOtp(contact: string, otp: string): Promise<boolean> {
    // Check account lock first
    await this.assertNotLocked(contact);

    // Find latest unexpired OTP for this contact
    const record = await this.prisma.loginOtp.findFirst({
      where: {
        contact,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new UnauthorizedException(
        'OTP not found or expired. Please request a new code.',
      );
    }

    const isValid = this.hash(otp) === record.otp;

    if (!isValid) {
      await this.recordFailedAttempt(contact);
      const attempt = await this.getAttemptCount(contact);
      const remaining = Math.max(0, MAX_VERIFY_TRIES - attempt);
      throw new UnauthorizedException(
        remaining > 0
          ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many failed attempts. Account temporarily locked.',
      );
    }

    // Valid — expire OTP immediately (single-use)
    await this.prisma.loginOtp.update({
      where: { id: record.id },
      data: { expiresAt: new Date() },
    });

    // Clear failed attempts on success
    await this.clearAttempts(contact);

    return true;
  }

  // ── Cleanup (run as scheduled task) ──────────────────────────────────────

  async cleanupExpired(): Promise<{ deleted: number }> {
    const result = await this.prisma.loginOtp.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { deleted: result.count };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertNotLocked(contact: string): Promise<void> {
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: { identifier: contact },
    });
    if (!attempt) return;
    if (attempt.lockExpiresAt && attempt.lockExpiresAt > new Date()) {
      const minutesLeft = Math.ceil(
        (attempt.lockExpiresAt.getTime() - Date.now()) / 60000,
      );
      throw new HttpException(
        `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedAttempt(contact: string): Promise<void> {
    const attempt = await this.prisma.loginAttempt.upsert({
      where: { identifier: contact },
      update: {
        count: { increment: 1 },
        lastAttemptAt: new Date(),
      },
      create: {
        identifier: contact,
        count: 1,
        lastAttemptAt: new Date(),
      },
    });

    if (attempt.count >= MAX_VERIFY_TRIES) {
      await this.prisma.loginAttempt.update({
        where: { identifier: contact },
        data: { lockExpiresAt: new Date(Date.now() + LOCK_DURATION_MS) },
      });
    }
  }

  private async getAttemptCount(contact: string): Promise<number> {
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: { identifier: contact },
    });
    return attempt?.count ?? 0;
  }

  private async clearAttempts(contact: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({
      where: { identifier: contact },
    });
  }

  private hash(plain: string): string {
    return crypto.createHash('sha256').update(plain).digest('hex');
  }

  private async dispatch(contact: string, otp: string, purpose: string): Promise<void> {
    const isPhone = /^\+?[0-9]{9,15}$/.test(contact);
    const message = `Your ZITO verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OTP DEV] ${isPhone ? 'SMS' : 'Email'} → ${contact}: ${otp}`);
      return;
    }

    if (isPhone && process.env.AT_API_KEY) {
      // Africa's Talking SMS — wire in Phase 2
    } else if (!isPhone && process.env.RESEND_API_KEY) {
      // Resend email — wire in Phase 2
    }
  }
}