import { InventoryStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  parcelId: string;

  @IsUUID()
  bookingId: string;

  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @IsNumber()
  weight: number;

  @IsBoolean()
  @IsOptional()
  isFragile?: boolean;

  @IsBoolean()
  @IsOptional()
  isHazmat?: boolean;

  @IsString()
  @IsOptional()
  dimensions?: string;

  @IsString()
  @IsOptional()
  expiryDate?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  binId?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class InventoryQueryDto {
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsEnum(InventoryStatus)
  @IsOptional()
  status?: InventoryStatus;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsUUID()
  @IsOptional()
  binId?: string;

  @IsString()
  @IsOptional()
  parcelId?: string;
}

export class UpdateInventoryStatusDto {
  @IsEnum(InventoryStatus)
  status: InventoryStatus;

  @IsUUID()
  @IsOptional()
  warehouseId?: string | null;

  @IsUUID()
  @IsOptional()
  binId?: string | null;

  @IsString()
  @IsOptional()
  currentVehicleId?: string | null;

  @IsString()
  @IsOptional()
  locationDescription?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
