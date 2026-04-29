import { Type } from 'class-transformer';
import { ServiceType, VehicleType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class WarehouseCapacityQueryDto {
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class FleetCapacityQueryDto {
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}

export class ForecastQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(7)
  @Max(90)
  days?: number;
}

export class EnforceCapacityDto {
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  cargoWeightKg?: number;

  @IsOptional()
  @IsUUID()
  agencyId?: string;
}
