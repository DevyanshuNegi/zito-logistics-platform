import { RtoStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class InitiateRtoDto {
  @IsUUID()
  bookingId: string;

  @IsString()
  reason: string;
}

export class UpdateRtoStatusDto {
  @IsEnum(RtoStatus)
  status: RtoStatus;
}

export class ReceiveRtoDto {
  @IsUUID()
  warehouseId: string;
}

export class RtoQueryDto {
  @IsEnum(RtoStatus)
  @IsOptional()
  status?: RtoStatus;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;
}
