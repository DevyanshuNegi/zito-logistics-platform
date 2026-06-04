import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Maps to VehiclePhotoType enum in schema.prisma (PRD §9 - Fleet System)
export const VEHICLE_PHOTO_CATEGORIES = [
  'PLATE',         // License plate close-up
  'FRONT',         // Front view
  'RIGHT',         // Right side view
  'LEFT',          // Left side view
  'REAR',          // Rear/back view
  'CHASSIS',       // Chassis/VIN evidence view
  'INSURANCE',     // Insurance document photo
  'LOGBOOK',       // Vehicle logbook / ownership document
  'NTSA_INSPECTION',
  'GOODS_TRANSPORT_LICENSE',
  'ROAD_SERVICE_LICENSE',
  'AXLE_LOAD_CERTIFICATE',
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
