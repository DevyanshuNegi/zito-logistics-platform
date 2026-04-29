import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { VehicleStatus, VehicleType } from '@prisma/client';

class BulkVehicleDto {
  @IsString()
  plateNumber: string;

  @IsEnum(VehicleType)
  type: VehicleType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacityKg: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityM3?: number;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsString()
  permitExpiry?: string;
}

export class BulkOnboardFleetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkVehicleDto)
  vehicles: BulkVehicleDto[];
}
