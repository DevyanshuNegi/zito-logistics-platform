import { WaybillStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateWaybillDto {
  @IsUUID()
  bookingId: string;

  @IsArray()
  @IsOptional()
  itemIds?: string[];
}

export class WaybillQueryDto {
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsEnum(WaybillStatus)
  @IsOptional()
  status?: WaybillStatus;

  @IsString()
  @IsOptional()
  type?: string;
}

export class UpdateWaybillStatusDto {
  @IsEnum(WaybillStatus)
  status: WaybillStatus;
}
