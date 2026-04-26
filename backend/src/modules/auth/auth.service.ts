import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class AuthService {

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(body: LoginDto) {
    if (!body) {
      throw new UnauthorizedException('Request body missing');
    }

    // PRD §3: Unified Login - identifier can be phone OR email
    const identifier = (body as any).email || (body as any).phone || (body as any).contact;
    const password = (body as any).password;
    const method = (body as any).method;

    // PRD §3: Check for temporary account lock before proceeding
    const lock = await (this.prisma as any).loginAttempt.findUnique({ where: { identifier } });
    if (lock && lock.lockExpiresAt && lock.lockExpiresAt > new Date()) {
      throw new UnauthorizedException(`Account temporarily locked. Please try again after ${lock.lockExpiresAt.toLocaleTimeString()}.`);
    }

    // 1. Find user by identifier (PRD v10 Unified Login)
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }]
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // PRD §3 Account Lifecycle: Only ACTIVE accounts may log in. 
    // Any other status results in a blocked session with a descriptive error.
    if (user.status && user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: `Account is ${user.status.toLowerCase()}`,
        data: { status: user.status }
      });
    } else if (!(user as any).isActive && !(user as any).status) {
      // Fallback if status field isn't present but isActive is
      throw new UnauthorizedException('Account is not active');
    }

    // 2. Compare password (required for Email + Password method, PRD §3)
    if (method === 'email_password' || (password && !method)) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    // PRD §3: Check for resend cooldown (30s) and maximum attempts (5)
    const existingOtp = await (this.prisma as any).loginOtp.findFirst({
      where: { contact: identifier },
      orderBy: { createdAt: 'desc' },
    });

    let resendCount = 0;
    if (existingOtp) {
      const elapsedMs = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsedMs < 30000) { // 30 seconds cooldown
        throw new UnauthorizedException(`Please wait ${Math.ceil((30000 - elapsedMs) / 1000)}s before requesting a new OTP.`);
      }
      if (existingOtp.resendCount >= 4) { // Allows 5 total sends (1 initial + 4 resends)
        throw new UnauthorizedException('Maximum resend attempts reached. Please try again later.');
      }
      resendCount = existingOtp.resendCount + 1;
    }

    // 3. Generate 6-digit OTP (PRD §3 / §15.1)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // PRD: 2-5 minutes

    await (this.prisma as any).loginOtp.deleteMany({ where: { contact: identifier } });
    await (this.prisma as any).loginOtp.create({
      data: {
        contact: identifier,
        otp,
        expiresAt,
        resendCount,
      },
    });

    // PRD §3: Session Continuity - generate a temporary token for the OTP step
    const tempToken = this.jwtService.sign({ contact: identifier, purpose: 'otp' }, { expiresIn: '10m' });

    // In a real scenario, integrate Resend.com here to send the OTP email
    console.log(`[DEV] OTP for ${identifier}: ${otp}`);

    return {
      message: 'OTP sent successfully',
      data: {
        temp_token: tempToken,
        contact: identifier,
      }
    };
  }

  async verifyOtp(contact: string, otp: string) {
    // PRD §3: Check if the identifier is currently locked
    const lock = await (this.prisma as any).loginAttempt.findUnique({ where: { identifier: contact } });
    if (lock && lock.lockExpiresAt && lock.lockExpiresAt > new Date()) {
      throw new UnauthorizedException('Account locked due to too many failed attempts.');
    }

    const otpRecord = await (this.prisma as any).loginOtp.findFirst({
      where: { contact, otp, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      // PRD §3: Track failed verification attempts
      const attempt = await (this.prisma as any).loginAttempt.upsert({
        where: { identifier: contact },
        update: { count: { increment: 1 }, lastAttemptAt: new Date() },
        create: { identifier: contact, count: 1 },
      });

      if (attempt.count >= 5) {
        await (this.prisma as any).loginAttempt.update({
          where: { identifier: contact },
          data: { lockExpiresAt: new Date(Date.now() + 15 * 60 * 1000) }, // 15-minute lock
        });
        throw new UnauthorizedException('Maximum attempts reached. Account locked for 15 minutes.');
      }
      throw new UnauthorizedException(`Invalid or expired OTP. ${5 - attempt.count} attempt(s) remaining.`);
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: contact }, { phone: contact }]
      }
    });
    if (!user) throw new UnauthorizedException('User no longer exists');

    // PRD v10 Lifecycle Rule: Block if not active
    if (user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active or has been suspended');
    }

    // Cleanup used OTP
    await (this.prisma as any).loginOtp.deleteMany({ where: { contact } });

    // PRD §3: Reset failed attempts on successful verification
    await (this.prisma as any).loginAttempt.deleteMany({ where: { identifier: contact } });

    const payload = { userId: user.id, email: user.email, role: user.role };
    
    // PRD §7.1 — Access and Refresh Token Generation
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      { expiresIn: '90d' } // PRD §3 / §15.1 Long-lived session
    );

    return {
      message: 'Login successful',
      data: {
        token: accessToken,
        refreshToken: refreshToken,
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        },
      }
    };
  }
}