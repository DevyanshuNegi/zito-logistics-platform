import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login to ZITO platform' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and receive access tokens' })
  @ApiResponse({ status: 200, description: 'OTP verified, tokens issued' })
  async verifyOtp(@Body() body: { contact: string; otp: string }) {
    return this.authService.verifyOtp(body.contact, body.otp);
  }
}