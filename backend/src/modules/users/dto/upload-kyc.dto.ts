import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum KycDocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  PASSPORT = 'PASSPORT',
  PROFILE_PHOTO = 'PROFILE_PHOTO',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  TRANSPORT_PERMIT = 'TRANSPORT_PERMIT',
  BUSINESS_REG = 'BUSINESS_REG',
  BUSINESS_PROOF = 'BUSINESS_PROOF',
  ADDRESS_VERIFICATION = 'ADDRESS_VERIFICATION',
  VEHICLE_REG = 'VEHICLE_REG',
  COMPANY_DETAILS = 'COMPANY_DETAILS',
  AUTHORIZED_PERSON_ID = 'AUTHORIZED_PERSON_ID',
  TAX_CERTIFICATE = 'TAX_CERTIFICATE',
  KRA_PIN_CERT = 'KRA_PIN_CERT',
  OPERATING_LICENSE = 'OPERATING_LICENSE',
  FLEET_DETAILS = 'FLEET_DETAILS',
  INSURANCE_CERT = 'INSURANCE_CERT',
  INSURANCE = 'INSURANCE',
  DRIVER_ASSIGNMENT = 'DRIVER_ASSIGNMENT',
  PERMIT_CERT = 'PERMIT_CERT',
  WAREHOUSE_OWNERSHIP_PROOF = 'WAREHOUSE_OWNERSHIP_PROOF',
  COMPLIANCE_CERTIFICATE = 'COMPLIANCE_CERTIFICATE',
}

export enum KycCaptureSource {
  CAMERA = 'CAMERA',
}

export class UploadKycDto {
  @ApiProperty({ enum: KycDocumentType })
  @IsEnum(KycDocumentType)
  documentType!: KycDocumentType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @ApiProperty({ required: false, example: 'KE' })
  @IsOptional()
  @IsString()
  countryOfIssue?: string;

  @ApiProperty({ required: false, example: 'FRONT' })
  @IsOptional()
  @IsString()
  documentSide?: string;

  @ApiProperty({ required: false, example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiProperty({ required: false, example: '2027-01-01' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: KycCaptureSource, example: KycCaptureSource.CAMERA })
  @IsIn([KycCaptureSource.CAMERA])
  captureSource!: KycCaptureSource;

  @ApiProperty({ example: '2026-06-03T09:00:00.000Z' })
  @IsDateString()
  capturedAt!: string;
}
