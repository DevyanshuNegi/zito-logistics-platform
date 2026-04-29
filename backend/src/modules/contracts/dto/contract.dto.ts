import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';

const BILLING_CYCLES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY'] as const;
const CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'SUPERSEDED'] as const;

export class CreateContractDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @IsString()
  businessName: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit: number;

  @IsIn(BILLING_CYCLES)
  billingCycle: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  paymentTermDays: number;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  paymentTermDays?: number;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
