import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// PRD §4 — KYC document types required per role:
//   CUSTOMER:          NATIONAL_ID
//   DRIVER:            NATIONAL_ID, DRIVERS_LICENSE
//   TRANSPORTER:       NATIONAL_ID, BUSINESS_REG, VEHICLE_REG
//   CORPORATE:         NATIONAL_ID, BUSINESS_REG
//   WAREHOUSE_PARTNER: NATIONAL_ID, BUSINESS_REG
export enum KycDocumentType {
  NATIONAL_ID     = 'NATIONAL_ID',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  BUSINESS_REG    = 'BUSINESS_REG',
  VEHICLE_REG     = 'VEHICLE_REG',
}

export class UploadKycDto {
  @ApiProperty({ enum: KycDocumentType })
  @IsEnum(KycDocumentType)
  documentType!: KycDocumentType;

  // PRD §4 — Expiry date for compliance tracking (license, insurance, permit)
  @ApiProperty({ required: false, example: '2027-01-01' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}