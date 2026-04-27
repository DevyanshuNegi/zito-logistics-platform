import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { KycDocumentDto } from './dto/kyc-document.dto';
import { AccountStatus, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, phone, password, fullName, role, agencyId } = dto;

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          { phone }
        ].filter(Boolean) as any,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or phone number already exists');
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const user = await this.prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        password: hashedPassword,
        role: role || UserRole.CUSTOMER,
        status: AccountStatus.PENDING,
        agencyId,
        driverProfile: role === UserRole.DRIVER ? { create: {} } : undefined,
      },
    });

    return {
      message: 'Registration successful. Account pending verification.',
      data: {
        id: user.id,
        status: user.status,
      },
    };
  }

  async uploadKycDocument(userId: string, dto: KycDocumentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.kycDocument.create({
      data: {
        userId: user.id,
        type: dto.type,
        fileUrl: dto.fileUrl,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });
  }

  async verifyUserStatus(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // PRD §4: Move user to VERIFIED status
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.VERIFIED },
    });

    // Automatically verify associated pending documents
    await this.prisma.kycDocument.updateMany({
      where: { userId: userId, status: 'PENDING' },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: adminId,
      },
    });

    return {
      message: 'User verified successfully. Account is now ready for activation.',
      data: { id: updatedUser.id, status: updatedUser.status },
    };
  }

  async activateUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.status !== AccountStatus.VERIFIED) {
      throw new ConflictException('User must be VERIFIED before they can be activated');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.ACTIVE },
    });

    return {
      message: 'Account activated successfully. The user can now log in.',
      data: { id: updatedUser.id, status: updatedUser.status },
    };
  }

  async login(body: LoginDto) {
    if (!body) {
      throw new UnauthorizedException('Request body missing');
    }

    // PRD §3: Unified Login - identifier can be phone OR email
      const { email, phone, contact, password, method } = body;
      const identifier = contact || email || phone;

    // PRD §3: Check for temporary account lock before proceeding
    const lock = await (this.prisma as any).loginAttempt.findUnique({ where: { identifier } });
    if (lock && lock.lockExpiresAt && lock.lockExpiresAt > new Date()) {
      throw new UnauthorizedException({
        message: 'Account temporarily locked',
        data: {
          lockExpiresAt: lock.lockExpiresAt,
          reason: 'Too many failed verification attempts',
        },
      });
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
    }

    // 2. Compare password (required for Email + Password method, PRD §3)
    if (method === 'email_password' || (password && !method)) {
      const isMatch = await bcrypt.compare(password, user.password || '');
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
        user: {
          fullName: user.fullName,
        },
      }
    };
  }

  async verifyOtp(tempToken: string, otp: string) {
    // PRD §3: Session Continuity - Verify the temporary token generated during login
    let contact: string;
    try {
      const decoded = this.jwtService.verify(tempToken);
      if (decoded.purpose !== 'otp') throw new Error();
      contact = decoded.contact;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired session token. Please login again.');
    }

    // PRD §3: Check if the identifier is currently locked
    const lock = await (this.prisma as any).loginAttempt.findUnique({ where: { identifier: contact } });
    if (lock && lock.lockExpiresAt && lock.lockExpiresAt > new Date()) {
      throw new UnauthorizedException({
        message: 'Account locked',
        data: {
          lockExpiresAt: lock.lockExpiresAt,
          reason: 'Too many failed verification attempts',
        },
      });
    }

    // PRD §3 Account Lifecycle: Identify user and verify status BEFORE OTP validation
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: contact }, { phone: contact }]
      }
    });
    if (!user) throw new UnauthorizedException('User no longer exists');

    if (user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: `Account is ${user.status.toLowerCase()}`,
        data: { status: user.status }
      });
    }

    const otpRecord = await (this.prisma as any).loginOtp.findFirst({
      where: { contact, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.otp !== otp) {
      // PRD §3: Track failed verification attempts
      const attempt = await (this.prisma as any).loginAttempt.upsert({
        where: { identifier: contact },
        update: { count: { increment: 1 }, lastAttemptAt: new Date() },
        create: { identifier: contact, count: 1 },
      });

      if (attempt.count >= 5) {
        const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
        await (this.prisma as any).loginAttempt.update({
          where: { identifier: contact },
          data: { lockExpiresAt },
        });
        throw new UnauthorizedException({
          message: 'Maximum attempts reached',
          data: {
            lockExpiresAt,
            reason: 'Account locked for 15 minutes due to repeated failures',
          },
        });
      }
      throw new UnauthorizedException({
        message: 'Invalid or expired OTP',
        data: {
          attemptsRemaining: 5 - attempt.count,
        },
      });
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
          role: user.role,
          fullName: user.fullName,
        },
      }
    };
  }
}