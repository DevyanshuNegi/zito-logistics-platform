import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsUUID()
  agencyId: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;
}

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  agencyId?: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;
}

export class CreateWarehouseZoneDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  capacity: number;
}

export class CreateWarehouseRackDto {
  @IsString()
  label: string;
}

export class CreateWarehouseBinDto {
  @IsString()
  label: string;
}

export class CreateWarehouseListingDto {
  @IsUUID()
  warehouseId: string;

  @IsString()
  companyName: string;

  @IsString()
  @IsOptional()
  companyEmail?: string;

  @IsString()
  @IsOptional()
  companyPhone?: string;

  @IsString()
  @IsOptional()
  vatNumber?: string;

  @IsBoolean()
  @IsOptional()
  vatApplies?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  vatRatePct?: number;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  areaLabel: string;

  @IsString()
  address: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  serviceRadiusKm?: number;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  storageTypes: string[];

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  photoUrls?: string[];

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  documentUrls?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCapacity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  availableCapacity: number;

  @IsString()
  @IsOptional()
  capacityUnit?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rateAmount: number;

  @IsString()
  @IsOptional()
  rateUnit?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  handlingFee?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  minimumBookingDays?: number;
}

export class ReviewWarehouseListingDto {
  @IsIn(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'SUSPENDED'])
  status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'SUSPENDED';

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateWarehouseBookingDto {
  @IsUUID()
  listingId: string;

  @IsString()
  storageType: string;

  @IsString()
  goodsDescription: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  capacityRequested: number;

  @IsString()
  @IsOptional()
  capacityUnit?: string;

  @IsString()
  @IsOptional()
  customerNote?: string;
}

export class UpdateWarehouseBookingStatusDto {
  @IsIn([
    'ACCEPTED',
    'REJECTED',
    'GOODS_RECEIVED',
    'IN_STORAGE',
    'READY_FOR_PICKUP',
    'COMPLETED',
    'CANCELLED',
  ])
  status:
    | 'ACCEPTED'
    | 'REJECTED'
    | 'GOODS_RECEIVED'
    | 'IN_STORAGE'
    | 'READY_FOR_PICKUP'
    | 'COMPLETED'
    | 'CANCELLED';

  @IsString()
  @IsOptional()
  note?: string;
}
