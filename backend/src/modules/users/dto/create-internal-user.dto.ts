import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateInternalUserDto {
  @ApiProperty({ example: 'Amina Hassan' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'Amina Logistics Ltd', required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ example: 'amina@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+254700000000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'StrongPass@2026', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    enum: [
      UserRole.CUSTOMER,
      UserRole.CORPORATE,
      UserRole.DRIVER,
      UserRole.AGENT,
      UserRole.TRANSPORTER,
      UserRole.COURIER_COMPANY,
      UserRole.WAREHOUSE_PARTNER,
      UserRole.AGENCY_STAFF,
    ],
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'OPERATIONS', required: false })
  @IsOptional()
  @IsString()
  staffRole?: string;

  @ApiProperty({ example: 'HEAD_OFFICE', required: false })
  @IsOptional()
  @IsString()
  staffScope?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiProperty({ enum: AccountStatus, required: false, default: AccountStatus.ACTIVE })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
