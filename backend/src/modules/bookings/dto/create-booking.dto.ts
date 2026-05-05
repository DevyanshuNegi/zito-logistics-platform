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
import {
  BookingCapacitySource,
  FreightTradeMode,
  RailCorridorCode,
  ServiceType,
  TradeDocumentStatus,
  VehicleType,
} from '@prisma/client';

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

  @IsEnum(BookingCapacitySource)
  @IsOptional()
  capacitySource?: BookingCapacitySource;

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

  @IsEnum(FreightTradeMode)
  @IsOptional()
  tradeMode?: FreightTradeMode;

  @IsEnum(RailCorridorCode)
  @IsOptional()
  railCorridorCode?: RailCorridorCode;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  originNode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  destinationNode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  containerReference?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  billOfLadingNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  idfNumber?: string;

  @IsBoolean()
  @IsOptional()
  pacReady?: boolean;

  @IsEnum(TradeDocumentStatus)
  @IsOptional()
  customsStatus?: TradeDocumentStatus;

  @IsEnum(TradeDocumentStatus)
  @IsOptional()
  icmsStatus?: TradeDocumentStatus;

  // Client-generated UUID — idempotency enforcement
  @IsUUID()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsUUID()
  @IsOptional()
  agencyId?: string;
}
