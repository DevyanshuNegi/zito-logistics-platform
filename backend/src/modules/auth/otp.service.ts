import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  private otpStore = new Map<string, { code: string; expiresAt: Date; attempts: number }>();

  async generateAndSendOtp(phone: string): Promise<void> {
    const existing = this.otpStore.get(phone);
    if (existing && existing.attempts >= 3) {
      throw new HttpException('Too many OTP requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const attempts = existing ? existing.attempts + 1 : 1;
    this.otpStore.set(phone, { code, expiresAt, attempts });

    // Log the generated OTP for debugging/simulation (since SMS is not hooked up yet)
    console.log(`[OTP Simulated] Sent OTP ${code} to ${phone}`);

    // Clean up expired OTPs automatically
    setTimeout(() => this.otpStore.delete(phone), 5 * 60 * 1000);
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const record = this.otpStore.get(phone);

    if (!record) {
      throw new BadRequestException('OTP not requested or expired');
    }

    if (new Date() > record.expiresAt) {
      this.otpStore.delete(phone);
      throw new BadRequestException('OTP has expired');
    }

    if (record.code !== code) {
      throw new BadRequestException('Invalid OTP code');
    }

    // Success, remove from store
    this.otpStore.delete(phone);
    return true;
  }
}
