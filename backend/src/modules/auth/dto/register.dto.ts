import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, Matches, MinLength } from 'class-validator';
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

  @ApiProperty({
    example: 'Acme Logistics Ltd',
    description: 'Company legal name for corporate, agent, transporter, courier-company, and warehouse-partner accounts',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ example: 'john@example.com', description: 'Valid email address', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+254700000000', description: 'Unique phone number for OTP verification' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Password123', description: 'Secure password (8+ chars, uppercase, lowercase, and number)', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include uppercase, lowercase, and number characters.',
  })
  password: string;

  @ApiProperty({ enum: UserRole, default: UserRole.CUSTOMER, description: 'Assigned platform role' })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ description: 'ID of the parent agency for staff/drivers', required: false })
  @IsString()
  @IsOptional()
  agencyId?: string;
}
