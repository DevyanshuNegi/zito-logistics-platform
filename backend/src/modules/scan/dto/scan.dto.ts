import { ScanCheckpoint } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class RecordScanDto {
  @IsUUID()
  itemId: string;

  @IsEnum(ScanCheckpoint)
  checkpoint: ScanCheckpoint;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  binId?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ValidateScanDto {
  @IsUUID()
  itemId: string;

  @IsEnum(ScanCheckpoint)
  checkpoint: ScanCheckpoint;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  binId?: string;
}

export class VehicleLoadDto {
  @IsUUID()
  itemId: string;

  @IsString()
  vehicleId: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class VehicleUnloadDto {
  @IsUUID()
  itemId: string;

  @IsString()
  vehicleId: string;

  @IsUUID()
  warehouseId: string;

  @IsUUID()
  @IsOptional()
  binId?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ConfirmDeliveryDto {
  @IsUUID()
  itemId: string;

  @IsString()
  deliveryOtp: string;

  @IsString()
  deliveryProofUrl: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
