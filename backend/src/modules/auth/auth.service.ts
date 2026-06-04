import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
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
  companyName: string | null;
  agencyId: string | null;
  staffDepartment: string | null;
  staffAgencyName: string | null;
  staffScope: 'HEAD_OFFICE' | 'AGENCY' | null;
};

const PUBLIC_SELF_SERVICE_ROLES = new Set<UserRole>([
  UserRole.CUSTOMER,
  UserRole.DRIVER,
  UserRole.AGENT,
  UserRole.TRANSPORTER,
  UserRole.COURIER_COMPANY,
  UserRole.WAREHOUSE_PARTNER,
  UserRole.CORPORATE,
]);

const HEAD_OFFICE_AGENCY_NAME = 'Zito Head Office';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionStateService: SessionStateService,
    private readonly otpService: OtpService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, phone, password, fullName, companyName, role, agencyId } = dto;
    const requestedRole = role || UserRole.CUSTOMER;

    this.assertAllowedPublicRole(requestedRole);
    this.assertCompanyIdentity(requestedRole, companyName);

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [email ? { email } : undefined, { phone }].filter(Boolean) as any,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or phone number already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName,
        companyName: companyName?.trim() || null,
        email,
        phone,
        password: hashedPassword,
        role: requestedRole,
        status: AccountStatus.PENDING,
        agencyId,
        driverProfile: requestedRole === UserRole.DRIVER ? { create: {} } : undefined,
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        kycDocuments: {
          select: {
            type: true,
            status: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const requiredDocs = {
      CUSTOMER: ['NATIONAL_ID'],
      DRIVER: ['NATIONAL_ID', 'DRIVERS_LICENSE'],
      AGENT: ['NATIONAL_ID', 'BUSINESS_REG', 'VEHICLE_REG'],
      TRANSPORTER: ['NATIONAL_ID', 'BUSINESS_REG', 'VEHICLE_REG'],
      COURIER_COMPANY: ['NATIONAL_ID', 'BUSINESS_REG'],
      CORPORATE: ['NATIONAL_ID', 'BUSINESS_REG'],
      WAREHOUSE_PARTNER: ['NATIONAL_ID', 'BUSINESS_REG'],
    }[user.role] ?? ['NATIONAL_ID'];

    const approvedTypes = new Set(
      user.kycDocuments
        .filter((document) => document.status === 'APPROVED')
        .map((document) => document.type),
    );
    const missingDocuments = requiredDocs.filter((documentType) => !approvedTypes.has(documentType));
    if (missingDocuments.length > 0) {
      throw new ConflictException(
        `All required compliance documents must be approved first: ${missingDocuments.join(', ')}`,
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.VERIFIED },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_VERIFIED',
        entityType: 'USER',
        entityId: userId,
        details: {
          verifiedFromLegacyRoute: true,
        } as Prisma.InputJsonValue,
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

    this.assertAccountCanAuthenticate(user);

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
        debugOtp: this.shouldExposeDevOtp() ? otpResult.debugOtp ?? null : null,
        debugDeliveryTarget: otpResult.debugDeliveryTarget ?? null,
        otpExpiresAt: otpResult.expiresAt?.toISOString() ?? null,
        resendAvailableAt: new Date(
          Date.now() + otpResult.cooldownRemaining * 1000,
        ).toISOString(),
        resendRemaining: otpResult.resendRemaining,
        user: {
          fullName: user.fullName,
          companyName: user.companyName,
          staffScope: user.staffScope,
          staffDepartment: user.staffDepartment,
          staffAgencyName: user.staffAgencyName,
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
        throw new Error('Invalid token purpose for OTP verification');
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

    this.assertAccountCanAuthenticate(user);

    try {
      await this.otpService.verifyOtp(contact, otp);
    } catch (error) {
      throw this.rewrapOtpError(error);
    }

    if (this.requiresEmailPassword(user, contact)) {
      const passwordToken = this.jwtService.sign(
        { contact, purpose: 'email_password_after_otp' },
        { expiresIn: '10m' },
      );

      return {
        message: 'OTP verified. Enter password to complete sign-in.',
        data: {
          requiresPassword: true as const,
          temp_token: passwordToken,
          contact,
        },
      };
    }

    return this.issueSession(user, context);
  }

  async completeEmailLogin(
    tempToken: string,
    password: string,
    context?: AuthRequestContext,
  ) {
    let contact: string;
    try {
      const decoded = this.jwtService.verify(tempToken);
      if (decoded.purpose !== 'email_password_after_otp') {
        throw new Error('Invalid token purpose for password completion');
      }
      contact = decoded.contact;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired password session. Start the email login flow again.',
      );
    }

    const user = await this.findUserByIdentifier(contact);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    this.assertAccountCanAuthenticate(user);

    if (!this.requiresEmailPassword(user, contact)) {
      throw new UnauthorizedException(
        'This account does not support email password completion on the public login flow.',
      );
    }

    const isMatch = await bcrypt.compare(password || '', user.password || '');
    if (!isMatch) {
      throw new UnauthorizedException('Invalid password.');
    }

    return this.issueSession(user, context);
  }

  async forgotPassword(email: string) {
    const identifier = this.normalizeIdentifier(email);
    if (!identifier || !identifier.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }

    const user = await this.findUserByIdentifier(identifier);
    if (!user || !user.email) {
      throw new NotFoundException('No account was found for this email address.');
    }

    await this.assertOtpNotLocked(identifier);
    const otpResult = await this.otpService.sendOtp(identifier, 'password-reset');
    if (!otpResult.sent) {
      throw new HttpException(
        {
          message: `Please wait ${otpResult.cooldownRemaining}s before requesting a new reset code.`,
          data: {
            cooldownRemaining: otpResult.cooldownRemaining,
            resendAvailableAt: new Date(
              Date.now() + otpResult.cooldownRemaining * 1000,
            ).toISOString(),
          },
        },
        429,
      );
    }

    return {
      message: 'Password reset code sent successfully.',
      data: {
        email: identifier,
        debugOtp: this.shouldExposeDevOtp() ? otpResult.debugOtp ?? null : null,
        resendAvailableAt: new Date(
          Date.now() + otpResult.cooldownRemaining * 1000,
        ).toISOString(),
      },
    };
  }

  async verifyResetOtp(email: string, otp: string) {
    const identifier = this.normalizeIdentifier(email);
    if (!identifier || !identifier.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }

    const user = await this.findUserByIdentifier(identifier);
    if (!user || !user.email) {
      throw new NotFoundException('No account was found for this email address.');
    }

    try {
      await this.otpService.verifyOtp(identifier, otp);
    } catch (error) {
      throw this.rewrapOtpError(error);
    }

    const resetToken = this.jwtService.sign(
      { contact: identifier, purpose: 'password_reset' },
      { expiresIn: '10m' },
    );

    return {
      message: 'Reset code verified.',
      data: { resetToken },
    };
  }

  async resetPassword(token: string, newPassword: string) {
    let contact: string;
    try {
      const decoded = this.jwtService.verify(token);
      if (decoded.purpose !== 'password_reset') {
        throw new Error('Invalid token purpose for password reset');
      }
      contact = decoded.contact;
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token. Request a new code.');
    }

    const user = await this.findUserByIdentifier(contact);
    if (!user) {
      throw new NotFoundException('User no longer exists.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      message: 'Password updated successfully. You can now sign in.',
      data: { email: contact },
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
    const refreshToken = this.shouldExposeLegacyRefreshToken()
      ? this.jwtService.sign(
          { userId: user.id, sessionId, purpose: 'refresh' },
          { expiresIn: '90d' },
        )
      : null;

    await this.logSession(
      user.id,
      sessionId,
      context?.ipAddress ?? null,
      context?.deviceInfo ?? null,
    );

    this.logger.log(
      `Session created for user ${user.id} role=${user.role} status=${user.status} session=${sessionId.slice(0, 8)}...`,
    );

    return {
      message: 'Login successful',
      data: {
        token: accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          fullName: user.fullName,
          companyName: user.companyName,
          agencyId: user.agencyId,
          staffScope: user.staffScope,
          staffDepartment: user.staffDepartment,
          staffAgencyName: user.staffAgencyName,
        },
      },
    };
  }

  private async findUserByIdentifier(identifier: string): Promise<AuthLookupUser | null> {
    const user = await this.prisma.user.findFirst({
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
        companyName: true,
        agencyId: true,
      },
    });

    if (!user) {
      return null;
    }

    if (user.role !== UserRole.AGENCY_STAFF) {
      return {
        ...user,
        staffDepartment: null,
        staffAgencyName: null,
        staffScope: null,
      };
    }

    const staffProfile = await this.prisma.staff.findFirst({
      where: { userId: user.id, isActive: true },
      select: {
        role: true,
        agency: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      ...user,
      staffDepartment: staffProfile?.role ?? null,
      staffAgencyName: staffProfile?.agency?.name ?? null,
      staffScope: staffProfile
        ? staffProfile.agency?.name === HEAD_OFFICE_AGENCY_NAME
          ? 'HEAD_OFFICE'
          : 'AGENCY'
        : null,
    };
  }

  private assertAccountCanAuthenticate(user: AuthLookupUser) {
    if (user.status === AccountStatus.SUSPENDED) {
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

  private requiresEmailPassword(user: AuthLookupUser, contact: string) {
    return Boolean(user.email && user.password && user.email === contact);
  }

  private rewrapOtpError(error: unknown) {
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
          data,
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
        data: {},
      },
      status,
    );
  }

  private assertAllowedPublicRole(role: UserRole) {
    if (PUBLIC_SELF_SERVICE_ROLES.has(role)) {
      return;
    }

    throw new ConflictException(
      'This role is provisioned internally and cannot be created from the public registration flow.',
    );
  }

  private assertCompanyIdentity(role: UserRole, companyName?: string | null) {
    if (!this.requiresCompanyName(role)) {
      return;
    }

    if (!companyName?.trim()) {
      throw new BadRequestException('Company name is required for this account type.');
    }
  }

  private requiresCompanyName(role: UserRole) {
    return (
      role === UserRole.CORPORATE ||
      role === UserRole.AGENT ||
      role === UserRole.COURIER_COMPANY ||
      role === UserRole.TRANSPORTER ||
      role === UserRole.WAREHOUSE_PARTNER
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

  private shouldExposeDevOtp() {
    return (
      process.env.NODE_ENV !== 'production' &&
      process.env.EXPOSE_DEV_OTP === 'true'
    );
  }

  private shouldExposeLegacyRefreshToken() {
    return (
      process.env.NODE_ENV !== 'production' &&
      process.env.EXPOSE_LEGACY_REFRESH_TOKEN === 'true'
    );
  }
}
