import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class CreateQuotationDto {
  @IsNumber()
  @Min(0)
  quotedPrice: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(14)
  validityDays?: number; // Default 2 days (48 hours)

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string; // e.g., "prepayment", "on-delivery", "installment"

  @IsOptional()
  @IsString()
  specialConditions?: string;
}
