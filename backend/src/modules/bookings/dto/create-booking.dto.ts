import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType } from '@prisma/client';

class BookingStopDto {
  @IsString()
  address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsString()
  contactName: string;

  @IsString()
  contactPhone: string;

  @IsEnum(['PICKUP', 'DELIVERY', 'STOP'])
  stopType: 'PICKUP' | 'DELIVERY' | 'STOP';
}

export class CreateBookingDto {
  @IsOptional()
  @IsString()
  agencyId?: string;

  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsNumber()
  estimatedDistKm: number;

  // Pricing fields (PRD §19)
  @IsOptional()
  @IsNumber()
  totalPrice?: number;

  @IsOptional()
  @IsNumber()
  baseFare?: number;

  @IsOptional()
  @IsNumber()
  distanceFare?: number;

  @IsOptional()
  @IsNumber()
  stopFare?: number;

  @IsOptional()
  @IsNumber()
  surgeMultiplier?: number;

  // Stops (CRITICAL PRD §6)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingStopDto)
  stops: BookingStopDto[];
}