import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_SECS = 30;
const MAX_RESENDS = 4;
const MAX_VERIFY_TRIES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export type OtpSendResult = {
  sent: boolean;
  cooldownRemaining: number;
  expiresAt?: Date;
  resendCount: number;
  resendRemaining: number;
};

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  async sendOtp(contact: string, purpose: string): Promise<OtpSendResult> {
    const recent = await this.prisma.loginOtp.findFirst({
      where: {
        contact,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;

      if (secondsSince < COOLDOWN_SECS) {
        const cooldownRemaining = Math.ceil(COOLDOWN_SECS - secondsSince);
        return {
          sent: false,
          cooldownRemaining,
          resendCount: recent.resendCount,
          resendRemaining: Math.max(0, MAX_RESENDS - recent.resendCount),
        };
      }

      if (recent.resendCount >= MAX_RESENDS) {
        throw new HttpException(
          {
            message: 'Maximum OTP requests reached. Please try again later.',
            data: {
              resendRemaining: 0,
              maxResends: MAX_RESENDS,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.prisma.loginOtp.update({
        where: { id: recent.id },
        data: { expiresAt: new Date() },
      });
    }

    const plainOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = this.hash(plainOtp);
    const resendCount = recent ? recent.resendCount + 1 : 0;
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.loginOtp.create({
      data: {
        contact,
        otp: hashedOtp,
        expiresAt,
        resendCount,
      },
    });

    await this.dispatch(contact, plainOtp, purpose);

    return {
      sent: true,
      cooldownRemaining: COOLDOWN_SECS,
      expiresAt,
      resendCount,
      resendRemaining: Math.max(0, MAX_RESENDS - resendCount),
    };
  }

  async verifyOtp(contact: string, otp: string): Promise<void> {
    await this.assertNotLocked(contact);

    const record = await this.prisma.loginOtp.findFirst({
      where: {
        contact,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new UnauthorizedException({
        message: 'OTP not found or expired. Please request a new code.',
        data: {
          attemptsRemaining: MAX_VERIFY_TRIES,
        },
      });
    }

    const isValid = this.hash(otp) === record.otp;

    if (!isValid) {
      const nextCount = await this.recordFailedAttempt(contact);
      const attemptsRemaining = Math.max(0, MAX_VERIFY_TRIES - nextCount);

      if (attemptsRemaining === 0) {
        const lock = await this.prisma.loginAttempt.findUnique({
          where: { identifier: contact },
          select: { lockExpiresAt: true },
        });

        throw new UnauthorizedException({
          message: 'Too many failed attempts. Account temporarily locked.',
          data: {
            attemptsRemaining,
            lockExpiresAt: lock?.lockExpiresAt ?? null,
          },
        });
      }

      throw new UnauthorizedException({
        message: `Invalid OTP. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`,
        data: {
          attemptsRemaining,
        },
      });
    }

    await this.prisma.loginOtp.update({
      where: { id: record.id },
      data: { expiresAt: new Date() },
    });

    await this.clearAttempts(contact);
  }

  getCooldownSeconds() {
    return COOLDOWN_SECS;
  }

  getOtpExpirySeconds() {
    return Math.floor(OTP_TTL_MS / 1000);
  }

  getMaxVerifyTries() {
    return MAX_VERIFY_TRIES;
  }

  getMaxResends() {
    return MAX_RESENDS;
  }

  async cleanupExpired(): Promise<{ deleted: number }> {
    const result = await this.prisma.loginOtp.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { deleted: result.count };
  }

  private async assertNotLocked(contact: string): Promise<void> {
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: { identifier: contact },
    });

    if (!attempt?.lockExpiresAt || attempt.lockExpiresAt <= new Date()) {
      return;
    }

    throw new HttpException(
      {
        message: 'Account temporarily locked.',
        data: {
          lockExpiresAt: attempt.lockExpiresAt,
          reason: 'Too many failed verification attempts',
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async recordFailedAttempt(contact: string): Promise<number> {
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

    return attempt.count;
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

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OTP DEV] ${isPhone ? 'SMS' : 'Email'} -> ${contact} (${purpose}): ${otp}`);
      return;
    }

    if (isPhone && process.env.AT_API_KEY) {
      return;
    }

    if (!isPhone && process.env.RESEND_API_KEY) {
      return;
    }
  }
}
