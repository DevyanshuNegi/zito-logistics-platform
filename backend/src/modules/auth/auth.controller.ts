import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Reauth } from '../../common/decorators/reauth.decorator';
import { ReauthGuard } from '../../common/guards/reauth.guard';
import { SessionGuard } from '../../common/guards/session.guard';
import { AuthService } from './auth.service';
import { Roles } from './decorators/roles.decorator';
import { ForceLogoutDto } from './dto/force-logout.dto';
import { KycUploadDto } from './dto/kyc-upload.dto';
import { LoginDto } from './dto/login.dto';
import { ReauthDto } from './dto/reauth.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'PRD §4: New user registration' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'PRD §3: Unified login via email/phone' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'PRD §3: Verify OTP and issue tokens' })
  async verifyOtp(@Req() req: any, @Body() verifyOtpDto: VerifyOtpDto) {
    const token = req.headers['authorization']?.split(' ')[1];
    return this.authService.verifyOtp(token, verifyOtpDto.otp, {
      ipAddress: this.getClientIp(req),
      deviceInfo:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : null,
    });
  }

  @Post('kyc-documents')
  @ApiOperation({ summary: 'PRD §4: Upload KYC document' })
  async uploadKyc(@Body() kycUploadDto: KycUploadDto) {
    const { userId, ...dto } = kycUploadDto;
    return this.authService.uploadKycDocument(userId, dto);
  }

  @Patch('verify-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin only: Verify a user after KYC review (PRD §4)' })
  @ApiResponse({ status: 200, description: 'User verified successfully' })
  async verifyUser(@Param('id') userId: string, @Req() req: any) {
    return this.authService.verifyUserStatus(userId, req.user.id);
  }

  @Patch('activate-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin only: Activate a verified user (PRD §4)' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  async activateUser(@Param('id') userId: string) {
    return this.authService.activateUserStatus(userId);
  }

  @Post('reauth')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiOperation({ summary: 'PRD §44.15: Re-authenticate before critical actions' })
  async reauth(@Req() req: any, @Body() dto: ReauthDto) {
    return this.authService.reauth(req.user.id, dto.password);
  }

  @Post('force-logout/:id')
  @UseGuards(JwtAuthGuard, SessionGuard, RolesGuard, ReauthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Reauth()
  @ApiOperation({ summary: 'PRD §44.15: Force logout all sessions for a target user' })
  async forceLogout(
    @Param('id') userId: string,
    @Req() req: any,
    @Body() dto: ForceLogoutDto,
  ) {
    return this.authService.forceLogout(userId, req.user.id, dto.reason);
  }

  private getClientIp(req: any) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? null;
  }
}
