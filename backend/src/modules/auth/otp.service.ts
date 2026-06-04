import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseOtpProvider } from './otp/firebase.provider';
import { OtpProvider, OtpProviderMode, maskOtpTarget } from './otp/otp-provider.interface';
import { TestOtpProvider } from './otp/test.provider';
import { TwilioOtpProvider } from './otp/twilio.provider';

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
  debugOtp?: string;
  debugDeliveryTarget?: string;
};

type OtpDispatchResult = {
  debugOtp?: string;
  debugDeliveryTarget?: string;
};

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioProvider: TwilioOtpProvider,
    private readonly testProvider: TestOtpProvider,
    private readonly firebaseProvider: FirebaseOtpProvider,
  ) {}

  async sendOtp(contact: string, purpose: string): Promise<OtpSendResult> {
    const provider = this.resolveProvider(contact);
    this.logger.log(
      `OTP provider selected: ${provider.mode} for ${maskOtpTarget(contact)} (${purpose})`,
    );

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

    const plainOtp = provider.mode === 'local'
      ? crypto.randomInt(100000, 999999).toString()
      : null;
    const hashedOtp = plainOtp
      ? this.hash(plainOtp)
      : this.hash(`provider:${provider.mode}:${contact}:${Date.now()}`);
    const resendCount = recent ? recent.resendCount + 1 : 0;
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const dispatchResult = await this.dispatch(provider, contact, plainOtp, purpose);

    await this.prisma.loginOtp.create({
      data: {
        contact,
        otp: hashedOtp,
        expiresAt,
        resendCount,
      },
    });

    return {
      sent: true,
      cooldownRemaining: COOLDOWN_SECS,
      expiresAt,
      resendCount,
      resendRemaining: Math.max(0, MAX_RESENDS - resendCount),
      debugOtp:
        dispatchResult.debugOtp ??
        (process.env.NODE_ENV === 'development' ? plainOtp ?? undefined : undefined),
      debugDeliveryTarget: dispatchResult.debugDeliveryTarget,
    };
  }

  async verifyOtp(contact: string, otp: string): Promise<void> {
    await this.assertNotLocked(contact);
    const provider = this.resolveProvider(contact);
    this.logger.log(
      `OTP verification using provider: ${provider.mode} for ${maskOtpTarget(contact)}`,
    );

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

    const isValid = provider.verify
      ? await provider.verify(contact, otp)
      : this.hash(otp) === record.otp;

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

  private async dispatch(
    provider: OtpProvider,
    contact: string,
    otp: null | string,
    purpose: string,
  ): Promise<OtpDispatchResult> {
    const isPhone = /^\+?[0-9]{9,15}$/.test(contact);

    if (provider.mode !== 'local') {
      return provider.send({
        contact,
        purpose,
        code: otp,
        isPhone,
      });
    }

    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(
        `OTP simulated locally for ${maskOtpTarget(contact)} (${purpose})`,
      );
      return {
        debugOtp: otp ?? undefined,
        debugDeliveryTarget: maskOtpTarget(contact),
      };
    }

    if (isPhone && process.env.AT_API_KEY) {
      return {};
    }

    if (!isPhone && process.env.RESEND_API_KEY) {
      return {};
    }

    return {};
  }

  private resolveProvider(contact: string): OtpProvider {
    const mode = this.getOtpMode(contact);
    if (mode === 'test') return this.testProvider;
    if (mode === 'twilio') return this.twilioProvider;
    if (mode === 'firebase') return this.firebaseProvider;
    return this.localProvider();
  }

  private getOtpMode(contact: string): OtpProviderMode {
    const configuredMode = (process.env.OTP_MODE ?? '').trim().toLowerCase();
    if (configuredMode === 'test' || configuredMode === 'firebase') {
      return configuredMode;
    }

    if (configuredMode === 'twilio') {
      return this.isPhoneContact(contact) ? 'twilio' : 'local';
    }

    if (this.shouldUseTwilioVerify(contact)) {
      return 'twilio';
    }

    return 'local';
  }

  private localProvider(): OtpProvider {
    return {
      mode: 'local',
      send: async () => ({}),
    };
  }

  private shouldUseTwilioVerify(contact: string) {
    const enabled =
      process.env.TWILIO_VERIFY_ENABLED === 'true' ||
      process.env.OTP_PROVIDER === 'twilio_verify';

    return (
      enabled &&
      this.isPhoneContact(contact) &&
      Boolean(process.env.TWILIO_VERIFY_SERVICE_SID) &&
      Boolean(process.env.TWILIO_ACCOUNT_SID) &&
      Boolean(process.env.TWILIO_AUTH_TOKEN)
    );
  }

  private isPhoneContact(contact: string) {
    return /^\+?[0-9]{9,15}$/.test(contact);
  }
}
