import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AccountStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { KycDocumentDto } from './dto/kyc-document.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionStateService } from './session-state.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionStateService: SessionStateService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, phone, password, fullName, role, agencyId } = dto;

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [email ? { email } : undefined, { phone }].filter(Boolean) as any,
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
    if (!user) {
      throw new NotFoundException('User not found');
    }

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
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.VERIFIED },
    });

    await this.prisma.kycDocument.updateMany({
      where: { userId, status: 'PENDING' },
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
    if (!user) {
      throw new NotFoundException('User not found');
    }

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

    const { email, phone, contact, password, method } = body;
    const identifier = contact || email || phone;

    const lock = await (this.prisma as any).loginAttempt.findUnique({
      where: { identifier },
    });
    if (lock && lock.lockExpiresAt && lock.lockExpiresAt > new Date()) {
      throw new UnauthorizedException({
        message: 'Account temporarily locked',
        data: {
          lockExpiresAt: lock.lockExpiresAt,
          reason: 'Too many failed verification attempts',
        },
      });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status && user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: `Account is ${user.status.toLowerCase()}`,
        data: { status: user.status },
      });
    }

    if (method === 'email_password' || (password && !method)) {
      const isMatch = await bcrypt.compare(password, user.password || '');
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const existingOtp = await (this.prisma as any).loginOtp.findFirst({
      where: { contact: identifier },
      orderBy: { createdAt: 'desc' },
    });

    let resendCount = 0;
    if (existingOtp) {
      const elapsedMs = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsedMs < 30000) {
        throw new UnauthorizedException(
          `Please wait ${Math.ceil((30000 - elapsedMs) / 1000)}s before requesting a new OTP.`,
        );
      }
      if (existingOtp.resendCount >= 4) {
        throw new UnauthorizedException(
          'Maximum resend attempts reached. Please try again later.',
        );
      }
      resendCount = existingOtp.resendCount + 1;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await (this.prisma as any).loginOtp.deleteMany({ where: { contact: identifier } });
    await (this.prisma as any).loginOtp.create({
      data: {
        contact: identifier,
        otp,
        expiresAt,
        resendCount,
      },
    });

    const tempToken = this.jwtService.sign(
      { contact: identifier, purpose: 'otp' },
      { expiresIn: '10m' },
    );

    console.log(`[DEV] OTP for ${identifier}: ${otp}`);

    return {
      message: 'OTP sent successfully',
      data: {
        temp_token: tempToken,
        contact: identifier,
        user: {
          fullName: user.fullName,
        },
      },
    };
  }

  async verifyOtp(
    tempToken: string,
    otp: string,
    context?: { ipAddress?: string | null; deviceInfo?: string | null },
  ) {
    let contact: string;
    try {
      const decoded = this.jwtService.verify(tempToken);
      if (decoded.purpose !== 'otp') {
        throw new Error();
      }
      contact = decoded.contact;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired session token. Please login again.',
      );
    }

    const lock = await (this.prisma as any).loginAttempt.findUnique({
      where: { identifier: contact },
    });
    if (lock && lock.lockExpiresAt && lock.lockExpiresAt > new Date()) {
      throw new UnauthorizedException({
        message: 'Account locked',
        data: {
          lockExpiresAt: lock.lockExpiresAt,
          reason: 'Too many failed verification attempts',
        },
      });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: contact }, { phone: contact }],
      },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: `Account is ${user.status.toLowerCase()}`,
        data: { status: user.status },
      });
    }

    const otpRecord = await (this.prisma as any).loginOtp.findFirst({
      where: { contact, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.otp !== otp) {
      const attempt = await (this.prisma as any).loginAttempt.upsert({
        where: { identifier: contact },
        update: { count: { increment: 1 }, lastAttemptAt: new Date() },
        create: { identifier: contact, count: 1 },
      });

      if (attempt.count >= 5) {
        const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
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

    await (this.prisma as any).loginOtp.deleteMany({ where: { contact } });
    await (this.prisma as any).loginAttempt.deleteMany({ where: { identifier: contact } });

    await this.detectSuspiciousLogin(
      user.id,
      context?.ipAddress ?? null,
      context?.deviceInfo ?? null,
    );

    const sessionId = randomUUID();
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { userId: user.id, sessionId, purpose: 'refresh' },
      { expiresIn: '90d' },
    );

    await this.logSession(
      user.id,
      sessionId,
      context?.ipAddress ?? null,
      context?.deviceInfo ?? null,
    );

    return {
      message: 'Login successful',
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        },
      },
    };
  }

  async reauth(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        status: true,
      },
    });

    if (!user || user.status !== AccountStatus.ACTIVE || !user.password) {
      throw new UnauthorizedException('Unable to re-authenticate this user.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Re-authentication failed.');
    }

    const reauthToken = this.jwtService.sign(
      {
        userId,
        purpose: 'reauth',
      },
      { expiresIn: '10m' },
    );

    return {
      message: 'Re-authentication successful.',
      data: {
        reauthToken,
        expiresInMinutes: 10,
      },
    };
  }

  async forceLogout(targetUserId: string, actorId: string, reason?: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found.');
    }

    const invalidatedCount = await this.sessionStateService.invalidateAllUserSessions(
      targetUserId,
      reason ?? 'Session invalidated by Super Admin.',
    );

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'FORCE_LOGOUT_ALL',
        entityType: 'USER',
        entityId: targetUserId,
        details: {
          reason: reason ?? null,
          invalidatedCount,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message: `All active sessions for ${targetUser.fullName ?? targetUser.id} have been invalidated.`,
      data: {
        userId: targetUser.id,
        invalidatedCount,
        inactivityTimeoutMinutes: this.sessionStateService.getTimeoutMinutes(),
      },
    };
  }

  private async logSession(
    userId: string,
    sessionId: string,
    ipAddress: string | null,
    deviceInfo: string | null,
  ) {
    await this.sessionStateService.restoreOrCreateSession({
      sessionId,
      userId,
      issuedAt: Math.floor(Date.now() / 1000),
      ipAddress,
      deviceInfo,
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'SESSION_LOGIN',
        entityType: 'AUTH',
        entityId: sessionId,
        details: {
          sessionId,
        } as Prisma.InputJsonValue,
        ipAddress,
        deviceInfo: this.sanitizeDeviceInfo(deviceInfo),
      },
    });
  }

  private async detectSuspiciousLogin(
    userId: string,
    ipAddress: string | null,
    deviceInfo: string | null,
  ) {
    const normalizedDeviceInfo = this.sanitizeDeviceInfo(deviceInfo);
    if (!ipAddress && !normalizedDeviceInfo) {
      return;
    }

    const previousSessions = await this.prisma.auditLog.findMany({
      where: {
        userId,
        action: 'SESSION_LOGIN',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        ipAddress: true,
        deviceInfo: true,
      },
    });

    if (previousSessions.length === 0) {
      return;
    }

    const isNewIp =
      Boolean(ipAddress) &&
      previousSessions.every((session) => session.ipAddress !== ipAddress);
    const isNewDevice =
      Boolean(normalizedDeviceInfo) &&
      previousSessions.every(
        (session) => session.deviceInfo !== normalizedDeviceInfo,
      );

    if (!isNewIp && !isNewDevice) {
      return;
    }

    await this.upsertSuspiciousLoginAlert({
      userId,
      ipAddress,
      deviceInfo: normalizedDeviceInfo,
      isNewIp,
      isNewDevice,
    });
  }

  private async upsertSuspiciousLoginAlert(input: {
    userId: string;
    ipAddress: string | null;
    deviceInfo: string | null;
    isNewIp: boolean;
    isNewDevice: boolean;
  }) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: 'SUSPICIOUS_LOGIN',
        entityType: 'USER',
        entityId: input.userId,
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const message = `Suspicious login detected for user ${input.userId}: ${input.isNewIp ? 'new IP' : 'known IP'}, ${input.isNewDevice ? 'new device' : 'known device'}.`;
    const metadata = {
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
      isNewIp: input.isNewIp,
      isNewDevice: input.isNewDevice,
      detectedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;

    if (existing) {
      await this.prisma.internalAlert.update({
        where: { id: existing.id },
        data: {
          severity: 'HIGH',
          message,
          metadata,
        },
      });
      return;
    }

    await this.prisma.internalAlert.create({
      data: {
        type: 'SUSPICIOUS_LOGIN',
        severity: 'HIGH',
        message,
        status: 'PENDING',
        entityType: 'USER',
        entityId: input.userId,
        metadata,
      },
    });
  }

  private sanitizeDeviceInfo(deviceInfo?: string | null) {
    return deviceInfo ? deviceInfo.slice(0, 240) : null;
  }
}
