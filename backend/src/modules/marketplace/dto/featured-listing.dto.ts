import { IsEnum, IsUUID, IsNumber, Min, Max, IsOptional } from 'class-validator';

/**
 * PHASE 1 REVENUE STREAM #3: Featured Listings
 * 
 * Pricing Tiers:
 * - FEATURED: 1-3 days, KES 500 per day
 * - PREMIUM: 4-7 days, KES 1,000 per day  
 * - VIP: Monthly, KES 5,000/month
 */

export enum FeaturedListingTier {
  FEATURED = 'FEATURED',    // 1-3 days, KES 500/day
  PREMIUM = 'PREMIUM',      // 4-7 days, KES 1,000/day
  VIP = 'VIP',              // Monthly, KES 5,000/month
}

export class PurchaseFeaturedListingDto {
  @IsUUID()
  bookingId: string; // Booking or Load to feature

  @IsEnum(FeaturedListingTier)
  tier: FeaturedListingTier;

  @IsNumber()
  @Min(1)
  @Max(30)
  durationDays: number; // How many days to feature
}

export class FeaturedListingPricingDto {
  tier: FeaturedListingTier;
  pricePerDay: number; // KES
  maxDays: number;
  minDays: number;
  description: string;
}

export class FeaturedListingResponseDto {
  id: string;
  bookingId: string;
  tier: FeaturedListingTier;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startDate: Date;
  expiryDate: Date;
  totalCost: number; // KES
  badgeColor: string;
  badgeLabel: string;
}
