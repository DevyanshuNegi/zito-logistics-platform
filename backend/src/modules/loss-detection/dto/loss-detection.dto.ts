import { LossReportStatus, ScanCheckpoint } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class DetectMismatchDto {
  @IsUUID()
  bookingId: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  expectedCount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  scannedCount?: number;

  @IsEnum(ScanCheckpoint)
  @IsOptional()
  checkpoint?: ScanCheckpoint;
}

export class DetectStaleDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  slaHours?: number;
}

export class CreateLossReportDto {
  @IsUUID()
  bookingId: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsString()
  type: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  estimatedValue: number;

  @IsArray()
  @IsOptional()
  evidenceUrls?: string[];
}

export class ReviewLossReportDto {
  @IsString()
  notes: string;
}

export class LossReportQueryDto {
  @IsEnum(LossReportStatus)
  @IsOptional()
  status?: LossReportStatus;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
