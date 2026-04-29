import { ServiceType, VehicleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateRateCardDto {
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsEnum(ServiceType)
  serviceType: ServiceType;

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
}
