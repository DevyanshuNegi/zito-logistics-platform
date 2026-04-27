import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class KycDocumentDto {
  @ApiProperty({ example: 'ID_FRONT', description: 'Type of document (e.g., NATIONAL_ID, DRIVERS_LICENSE)' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'https://storage.zito.com/kyc/doc123.jpg', description: 'URL of the uploaded file' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ example: '2026-01-01', description: 'Optional expiry date for the document', required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}