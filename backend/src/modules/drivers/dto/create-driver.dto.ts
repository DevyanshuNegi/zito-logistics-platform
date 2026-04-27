import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseNumber?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseExpiry?: string;
}
