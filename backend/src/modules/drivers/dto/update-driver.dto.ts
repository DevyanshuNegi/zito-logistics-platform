import { IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class UpdateDriverDto {
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsNumber()
  currentLatitude?: number;

  @IsOptional()
  @IsNumber()
  currentLongitude?: number;
}