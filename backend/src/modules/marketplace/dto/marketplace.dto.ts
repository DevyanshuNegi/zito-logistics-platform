import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const MARKETPLACE_PARTNER_TYPES = ['TRANSPORTER', 'WAREHOUSE'] as const;
export const MARKETPLACE_PARTNER_STATUSES = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;
export const MARKETPLACE_PRICING_MODELS = [
  'FIXED_PRICE',
  'OPEN_BID',
  'NEGOTIATION',
] as const;
export const MARKETPLACE_BID_ACTIONS = ['ACCEPT', 'REJECT', 'COUNTER'] as const;

export class CreateMarketplaceTransporterDto {
  @IsUUID()
  userId: string;

  @IsString()
  companyName: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  serviceAreas?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  vehicleIds?: string[];

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  baseLatitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  baseLongitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  serviceRadiusKm?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRatePct?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFeeFlat?: number;

  @IsOptional()
  @IsBoolean()
  premiumListing?: boolean;
}

export class SelfMarketplaceTransporterDto {
  @IsString()
  companyName: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  serviceAreas?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  vehicleIds?: string[];

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  baseLatitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  baseLongitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  serviceRadiusKm?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRatePct?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFeeFlat?: number;

  @IsOptional()
  @IsBoolean()
  premiumListing?: boolean;
}

export class CreateMarketplaceWarehouseDto {
  @IsUUID()
  userId: string;

  @IsString()
  companyName: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  serviceAreas?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  warehouseIds?: string[];

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  baseLatitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  baseLongitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  serviceRadiusKm?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRatePct?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFeeFlat?: number;

  @IsOptional()
  @IsBoolean()
  premiumListing?: boolean;
}

export class SelfMarketplaceWarehouseDto {
  @IsString()
  companyName: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  serviceAreas?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  warehouseIds?: string[];

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  baseLatitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  baseLongitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  serviceRadiusKm?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRatePct?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFeeFlat?: number;

  @IsOptional()
  @IsBoolean()
  premiumListing?: boolean;
}

export class UpdateMarketplacePartnerStatusDto {
  @IsIn(MARKETPLACE_PARTNER_STATUSES)
  status: (typeof MARKETPLACE_PARTNER_STATUSES)[number];

  @IsOptional()
  @IsString()
  note?: string;
}

export class PublishMarketplaceOpportunityDto {
  @IsOptional()
  @IsIn(MARKETPLACE_PARTNER_TYPES)
  partnerType?: (typeof MARKETPLACE_PARTNER_TYPES)[number];

  @IsIn(MARKETPLACE_PRICING_MODELS)
  pricingModel: (typeof MARKETPLACE_PRICING_MODELS)[number];

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumBid?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class MarketplaceBidDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RespondMarketplaceBidDto {
  @IsIn(MARKETPLACE_BID_ACTIONS)
  action: (typeof MARKETPLACE_BID_ACTIONS)[number];

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  counterAmount?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
