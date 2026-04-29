import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class GenerateWarehouseInvoiceDto {
  @IsUUID()
  warehouseId: string;

  @IsUUID()
  customerId: string;

  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratePerUnitPerDay: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  issueImmediately?: boolean;
}

export class ConsolidateInvoiceDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsArray()
  bookingIds?: string[];

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  issueImmediately?: boolean;
}
