import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
  Min,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType, VehicleType } from '@prisma/client';

export class BookingStopDto {
  @IsNumber()
  sequence: number;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  @IsOptional()
  landmark?: string;

  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  // PICKUP | DELIVERY | LOAD | UNLOAD | INTERMEDIATE
  @IsString()
  stopType: string;
}

export class CreateBookingDto {
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  // Must match VehicleType enum — used to look up RateCard
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  // Minimum 2 stops: first = pickup, last = delivery
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingStopDto)
  stops: BookingStopDto[];

  @IsString()
  @IsOptional()
  cargoType?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  cargoWeightKg?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  cargoDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  specialInstructions?: string;

  @IsBoolean()
  @IsOptional()
  isScheduled?: boolean;

  // Client-generated UUID — idempotency enforcement
  @IsUUID()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsUUID()
  @IsOptional()
  agencyId?: string;
}
