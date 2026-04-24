import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

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

    const { email, password } = body;

    // 1. Find user by email or phone (PRD v10 Unified Login)
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone: email }]
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Generate 6-digit OTP (PRD §15.1)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    await (this.prisma as any).loginOtp.create({
      data: {
        contact: email,
        otp,
        expiresAt,
      },
    });

    // In a real scenario, integrate Resend.com here to send the OTP email
    console.log(`[DEV] OTP for ${email}: ${otp}`);

    return {
      success: true,
      message: 'OTP sent to email',
      contact: email,
    };
  }

  async verifyOtp(contact: string, otp: string) {
    const otpRecord = await (this.prisma as any).loginOtp.findFirst({
      where: { contact, otp, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: contact }, { phone: contact }]
      }
    });
    if (!user) throw new UnauthorizedException('User no longer exists');

    // PRD v10 Lifecycle Rule: Block if not active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is not active or has been suspended');
    }

    // Cleanup used OTP
    await (this.prisma as any).loginOtp.deleteMany({ where: { contact } });

    const payload = { userId: user.id, email: user.email, roles: (user as any).roles };
    
    // PRD §7.1 — Access and Refresh Token Generation
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      { expiresIn: '90d' } // PRD §15.1
    );

    return {
      success: true,
      message: 'Login successful',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { id: user.id, email: user.email, roles: (user as any).roles },
      }
    };
  }
}