import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { KycDocumentDto } from './dto/kyc-document.dto';
import { LoginDto } from './dto/login.dto';
import { OtpService } from './otp.service';
import { RegisterDto } from './dto/register.dto';
import { SessionStateService } from './session-state.service';

type AuthRequestContext = {
  ipAddress?: string | null;
  deviceInfo?: string | null;
};

type AuthLookupUser = {
  id: string;
  email: string | null;
  phone: string;
  password: string | null;
  role: UserRole;
  status: AccountStatus;
  fullName: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionStateService: SessionStateService,
    private readonly otpService: OtpService,
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

  async login(body: LoginDto, context?: AuthRequestContext) {
    if (!body) {
      throw new UnauthorizedException('Request body missing');
    }

    const identifier = this.normalizeIdentifier(body.contact || body.email || body.phone);
    if (!identifier) {
      throw new UnauthorizedException('Email or phone is required.');
    }

    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid email, phone, or password.');
    }

    this.assertAccountIsActive(user);

    if (body.method === 'email_password' || (body.password && !body.method)) {
      return this.loginWithPassword(user, identifier, body.password, context);
    }

    await this.assertOtpNotLocked(identifier);

    const otpResult = await this.otpService.sendOtp(identifier, 'login');
    if (!otpResult.sent) {
      throw new HttpException(
        {
          message: `Please wait ${otpResult.cooldownRemaining}s before requesting a new OTP.`,
          data: {
            cooldownRemaining: otpResult.cooldownRemaining,
            resendRemaining: otpResult.resendRemaining,
            resendAvailableAt: new Date(
              Date.now() + otpResult.cooldownRemaining * 1000,
            ).toISOString(),
          },
        },
        429,
      );
    }

    const tempToken = this.jwtService.sign(
      { contact: identifier, purpose: 'otp' },
      { expiresIn: `${this.otpService.getOtpExpirySeconds()}s` },
    );

    return {
      message: 'OTP sent successfully',
      data: {
        temp_token: tempToken,
        contact: identifier,
        otpExpiresAt: otpResult.expiresAt?.toISOString() ?? null,
        resendAvailableAt: new Date(
          Date.now() + otpResult.cooldownRemaining * 1000,
        ).toISOString(),
        resendRemaining: otpResult.resendRemaining,
        user: {
          fullName: user.fullName,
        },
      },
    };
  }

  async verifyOtp(
    tempToken: string,
    otp: string,
    context?: AuthRequestContext,
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

    const user = await this.findUserByIdentifier(contact);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    this.assertAccountIsActive(user);

    try {
      await this.otpService.verifyOtp(contact, otp);
    } catch (error) {
      throw this.rewrapOtpError(error, this.canUsePasswordFallback(user, contact));
    }

    return this.issueSession(user, context);
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

  private async loginWithPassword(
    user: AuthLookupUser,
    identifier: string,
    password: string | undefined,
    context?: AuthRequestContext,
  ) {
    if (!user.email || identifier !== user.email) {
      throw new UnauthorizedException({
        message: 'Email and password sign-in requires an email address.',
        data: {
          passwordFallbackEligible: false,
        },
      });
    }

    if (!user.password) {
      throw new UnauthorizedException({
        message: 'Password sign-in is not enabled for this account. Use the one-time code flow instead.',
        data: {
          passwordFallbackEligible: false,
        },
      });
    }

    const isMatch = await bcrypt.compare(password || '', user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user, context);
  }

  private async issueSession(user: AuthLookupUser, context?: AuthRequestContext) {
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
          phone: user.phone,
          role: user.role,
          fullName: user.fullName,
        },
      },
    };
  }

  private async findUserByIdentifier(identifier: string): Promise<AuthLookupUser | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
      select: {
        id: true,
        email: true,
        phone: true,
        password: true,
        role: true,
        status: true,
        fullName: true,
      },
    });
  }

  private assertAccountIsActive(user: AuthLookupUser) {
    if (user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: `Account is ${user.status.toLowerCase()}`,
        data: { status: user.status },
      });
    }
  }

  private async assertOtpNotLocked(identifier: string) {
    const lock = await this.prisma.loginAttempt.findUnique({
      where: { identifier },
      select: { lockExpiresAt: true },
    });

    if (!lock?.lockExpiresAt || lock.lockExpiresAt <= new Date()) {
      return;
    }

    throw new HttpException(
      {
        message: 'Account temporarily locked.',
        data: {
          lockExpiresAt: lock.lockExpiresAt,
          reason: 'Too many failed verification attempts',
        },
      },
      429,
    );
  }

  private canUsePasswordFallback(user: AuthLookupUser, contact: string) {
    return Boolean(user.email && user.password && user.email === contact);
  }

  private rewrapOtpError(error: unknown, passwordFallbackEligible: boolean) {
    const status =
      typeof (error as { getStatus?: () => number })?.getStatus === 'function'
        ? (error as { getStatus: () => number }).getStatus()
        : 401;
    const response =
      typeof (error as { getResponse?: () => unknown })?.getResponse === 'function'
        ? (error as { getResponse: () => unknown }).getResponse()
        : null;

    if (response && typeof response === 'object') {
      const payload = response as { message?: unknown; data?: unknown };
      const data =
        payload.data && typeof payload.data === 'object'
          ? (payload.data as Record<string, unknown>)
          : {};

      return new HttpException(
        {
          message:
            typeof payload.message === 'string'
              ? payload.message
              : 'OTP verification failed.',
          data: {
            ...data,
            passwordFallbackEligible,
          },
        },
        status,
      );
    }

    return new HttpException(
      {
        message:
          typeof response === 'string'
            ? response
            : error instanceof Error
              ? error.message
              : 'OTP verification failed.',
        data: {
          passwordFallbackEligible,
        },
      },
      status,
    );
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

  private normalizeIdentifier(identifier?: string | null) {
    if (!identifier) {
      return '';
    }

    const trimmed = identifier.trim();
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }

    return trimmed.replace(/\s+/g, '');
  }

  private sanitizeDeviceInfo(deviceInfo?: string | null) {
    return deviceInfo ? deviceInfo.slice(0, 240) : null;
  }
}
