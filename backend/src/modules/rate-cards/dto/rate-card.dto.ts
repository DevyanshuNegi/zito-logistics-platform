import { ServiceType, VehicleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_CURRENCY_CODES,
} from '../../../config/app.config';

export class CreateRateCardDto {
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: (typeof SUPPORTED_COUNTRY_CODES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  county?: string;

  @IsOptional()
  @IsIn(['ANY', 'TOWN', 'RURAL'])
  localityType?: 'ANY' | 'TOWN' | 'RURAL';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseFare: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratePerKm: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  perStopRate?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  minDistance?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  surgeMultiplier?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRateCardDto {
  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: (typeof SUPPORTED_COUNTRY_CODES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  county?: string;

  @IsOptional()
  @IsIn(['ANY', 'TOWN', 'RURAL'])
  localityType?: 'ANY' | 'TOWN' | 'RURAL';

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFare?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  ratePerKm?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  perStopRate?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  minDistance?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  surgeMultiplier?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CalculateRateCardDto {
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stopCount: number;

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCY_CODES)
  currency?: (typeof SUPPORTED_CURRENCY_CODES)[number];

  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: (typeof SUPPORTED_COUNTRY_CODES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  county?: string;

  @IsOptional()
  @IsIn(['ANY', 'TOWN', 'RURAL'])
  localityType?: 'ANY' | 'TOWN' | 'RURAL';
}
