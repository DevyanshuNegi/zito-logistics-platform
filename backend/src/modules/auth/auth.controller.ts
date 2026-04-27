import { Controller, Post, Body, Req, Patch, Param, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { KycDocumentDto } from './dto/kyc-document.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { KycUploadDto } from './dto/kyc-upload.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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
    return this.authService.verifyOtp(token, verifyOtpDto.otp);
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
    const admin = req.user;
    return this.authService.verifyUserStatus(userId, admin.id);
  }

  @Patch('activate-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin only: Activate a verified user (PRD §4)' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  async activateUser(@Param('id') userId: string) {
    return this.authService.activateUserStatus(userId);
  }
}