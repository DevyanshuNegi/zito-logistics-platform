import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

/**
 * PRD §4: User Registration DTO.
 * Captures essential data for KYC compliance and account lifecycle initialization.
 */
export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full legal name of the user' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'john@example.com', description: 'Valid email address', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+254700000000', description: 'Unique phone number for OTP verification' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'password123', description: 'Secure password (min 6 characters)', minLength: 6, required: false })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.CUSTOMER, description: 'Assigned platform role' })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ description: 'ID of the parent agency for staff/drivers', required: false })
  @IsString()
  @IsOptional()
  agencyId?: string;
}
