import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const VEHICLE_PHOTO_CATEGORIES = [
  'NUMBER_PLATE',
  'FRONT',
  'RIGHT',
  'LEFT',
  'BACK',
  'CHASSIS',
  'INSURANCE',
] as const;

export type VehiclePhotoCategory = (typeof VEHICLE_PHOTO_CATEGORIES)[number];

export class UploadVehiclePhotoDto {
  @ApiProperty({ enum: VEHICLE_PHOTO_CATEGORIES })
  @IsString()
  @IsIn(VEHICLE_PHOTO_CATEGORIES)
  category!: VehiclePhotoCategory;

  @ApiProperty({ required: false, example: '2026-05-05T08:20:00.000Z' })
  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}
