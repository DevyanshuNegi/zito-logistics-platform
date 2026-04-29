import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CrossBorderHandoffDto {
  @IsUUID()
  toAgencyId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  confirmedItemIds?: string[];

  @IsOptional()
  @IsUUID()
  receivingWarehouseId?: string;

  @IsOptional()
  @IsString()
  originCountryCode?: string;

  @IsOptional()
  @IsString()
  destinationCountryCode?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
