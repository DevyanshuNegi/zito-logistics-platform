import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class InterAgencyBillDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsUUID()
  originAgencyId?: string;

  @IsOptional()
  @IsUUID()
  destinationAgencyId?: string;

  @IsOptional()
  @IsString()
  originCountryCode?: string;

  @IsOptional()
  @IsString()
  destinationCountryCode?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  destinationSharePct?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;
}
