import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum KycDocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  BUSINESS_REG = 'BUSINESS_REG',
  VEHICLE_REG = 'VEHICLE_REG',
  KRA_PIN_CERT = 'KRA_PIN_CERT',
  INSURANCE_CERT = 'INSURANCE_CERT',
  PERMIT_CERT = 'PERMIT_CERT',
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
}
