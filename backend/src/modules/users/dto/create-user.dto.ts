import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// PRD §4 — Only email and phone are user-editable; role/status locked
// Note: fullName removed — not in UpdateUserDto to avoid service mismatch
export class UpdateUserDto {
  @ApiProperty({ required: false, example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '+254700000000' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()+]{7,15}$/, { message: 'Invalid phone number format' })
  phone?: string;
}