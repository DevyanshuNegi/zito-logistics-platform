import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class UpdateQuotationDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  quotedPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(14)
  extendValidityDays?: number;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  specialConditions?: string;

  @IsOptional()
  @IsString()
  revisionNote?: string; // If present, transitions booking back to SEARCHING
}
