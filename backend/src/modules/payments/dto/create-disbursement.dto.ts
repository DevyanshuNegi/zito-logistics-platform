import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisbursementRail } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDisbursementDto {
  @ApiProperty({ enum: DisbursementRail })
  @IsEnum(DisbursementRail)
  rail: DisbursementRail;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Short business reason for the payout or settlement' })
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  purpose: string;

  @ApiProperty({ description: 'Human-readable beneficiary name' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  beneficiaryName: string;

  @ApiPropertyOptional({ description: 'Beneficiary mobile number for M-Pesa B2C' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  beneficiaryPhone?: string;

  @ApiPropertyOptional({ description: 'Receiving shortcode / till / paybill for M-Pesa B2B' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  beneficiaryPartyNumber?: string;

  @ApiPropertyOptional({ description: 'Account reference echoed to the receiving finance rail' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountReference?: string;

  @ApiPropertyOptional({ description: 'Optional internal user tied to the beneficiary entity' })
  @IsOptional()
  @IsUUID()
  beneficiaryUserId?: string;

  @ApiPropertyOptional({ description: 'Optional source payment that funded the disbursement' })
  @IsOptional()
  @IsUUID()
  sourcePaymentId?: string;

  @ApiPropertyOptional({ description: 'Optional invoice being settled through this payout' })
  @IsOptional()
  @IsUUID()
  sourceInvoiceId?: string;
}
