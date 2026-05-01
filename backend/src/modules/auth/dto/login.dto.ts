import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * PRD §3: Unified Login DTO.
 * Supports authentication via email, phone, or a generic contact identifier.
 */
export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address for login', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+254700000000', description: 'Phone number for login', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'user@example.com', description: 'Generic identifier (email or phone)', required: false })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiProperty({ example: 'password123', description: 'Reserved for future internal flows; public login starts with OTP.', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'otp', description: 'Initial public login method. Public login always starts with OTP.', required: false })
  @IsString()
  @IsOptional()
  method?: string;
}
