import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSurgeZoneDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  radiusKm: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  surgeMultiplier?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSurgeZoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  radiusKm?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  surgeMultiplier?: number;
}

export class ActivateSurgeZoneDto {
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  surgeMultiplier?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class OverrideSurgeZoneDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  surgeMultiplier: number;

  @IsOptional()
  @IsBoolean()
  forceActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
