import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class OnboardPartnerDriverDto {
  @ApiProperty({ example: 'Rahul Singh' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'rahul.driver@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'Driver@123',
    description:
      'Optional initial password. If omitted, the system generates a temporary password for the driver invite.',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: 'DL-1234567890' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '2028-12-31T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  licenseExpiry?: string;

  @ApiPropertyOptional({
    example: 'c10f5ecb-29a2-4b39-8f8b-9d7da33d2fd1',
    description:
      'Optional explicit owner account for admin-created driver records. Fleet-owner self-service flows ignore this and use the current actor.',
  })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}
