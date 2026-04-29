import { ScanCheckpoint } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

class ScanSyncMetadataDto {
  @IsString()
  @IsOptional()
  clientReference?: string;

  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @IsIn(['ONLINE', 'OFFLINE'])
  @IsOptional()
  syncMode?: 'ONLINE' | 'OFFLINE';
}

export class RecordScanDto extends ScanSyncMetadataDto {
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

export class VehicleLoadDto extends ScanSyncMetadataDto {
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

export class VehicleUnloadDto extends ScanSyncMetadataDto {
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

export class ConfirmDeliveryDto extends ScanSyncMetadataDto {
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
