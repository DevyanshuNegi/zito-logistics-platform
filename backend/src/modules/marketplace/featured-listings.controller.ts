import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { FeaturedListingsService } from './featured-listings.service';
import { PurchaseFeaturedListingDto } from './dto/featured-listing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('marketplace/featured')
@UseGuards(JwtAuthGuard)
export class FeaturedListingsController {
  constructor(private readonly featured: FeaturedListingsService) {}

  /**
   * Get pricing tiers
   * PUBLIC: No auth required
   * Response: Array of pricing tiers (FEATURED, PREMIUM, VIP)
   */
  @Get('pricing')
  async getPricingTiers() {
    return this.featured.getPricingTiers();
  }

  /**
   * Purchase featured listing
   * PHASE 1: Shipper clicks "Make Featured" on a booking → Select tier → Pay → Badge appears
   * 
   * Flow:
   * 1. User selects booking to feature
   * 2. User selects tier (FEATURED: 1-3 days, PREMIUM: 4-7 days, VIP: 30 days)
   * 3. User enters duration
   * 4. POST /marketplace/featured with bookingId, tier, durationDays
   * 5. Backend calculates cost, deducts from wallet
   * 6. Booking gets featured badge in marketplace
   * 7. Featured loads appear at top of search results
   * 
   * Pricing:
   * - FEATURED: KES 500/day → KES 500-1,500 for 1-3 days
   * - PREMIUM: KES 1,000/day → KES 4,000-7,000 for 4-7 days
   * - VIP: KES 5,000/month
   * 
   * Error Cases:
   * - Booking not found: 404
   * - Already featured: 409
   * - Insufficient wallet: 402
   * - Duration invalid: 400
   * 
   * Response:
   * - id: featured listing ID
   * - tier: Selected tier
   * - expiryDate: When badge expires
   * - totalCost: Amount deducted (KES)
   */
  @Post()
  async purchaseFeaturedListing(
    @Req() req: any,
    @Body() dto: PurchaseFeaturedListingDto,
  ) {
    const userId = req.user.id;
    return this.featured.purchaseFeaturedListing(userId, dto);
  }

  /**
   * Get featured listing details
   */
  @Get(':id')
  async getFeaturedListing(@Param('id') id: string, @Req() req: any) {
    return this.featured.getFeaturedListing(id, req.user);
  }

  /**
   * Extend featured listing duration
   * PHASE 1: User clicks "Extend" on expiring featured listing → Additional days + payment
   * 
   * Flow:
   * 1. User selects featured listing to extend
   * 2. User enters additional days
   * 3. PATCH /marketplace/featured/:id/extend with additionalDays
   * 4. Cost = additionalDays * tierPricePerDay
   * 5. Deduct from wallet
   * 6. Extend expiryDate
   * 
   * Response:
   * - Updated featured listing with new expiryDate
   */
  @Post(':id/extend')
  async extendFeaturedListing(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { additionalDays: number },
  ) {
    const userId = req.user.id;
    return this.featured.extendFeaturedListing(id, userId, body.additionalDays);
  }

  /**
   * Cancel featured listing
   * PHASE 1: User clicks "Cancel" → Refund if within 24 hours, badge removed
   * 
   * Refund Policy:
   * - Within 24 hours of purchase: Full refund to wallet
   * - After 24 hours: No refund
   * 
   * Response:
   * - success: true
   * - refund: Amount refunded (or 0)
   */
  @Delete(':id')
  async cancelFeaturedListing(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req.user.id;
    await this.featured.cancelFeaturedListing(id, userId);
    return { message: 'Featured listing cancelled' };
  }

  /**
   * List active featured listings
   * Used by: Marketplace to show featured loads at top of search results
   * PUBLIC: Can be called without auth for search filtering
   * 
   * Response:
   * Array of featured listings with booking details:
   * - VIP listings first (highest visibility)
   * - PREMIUM listings second
   * - FEATURED listings last
   */
  @Get()
  async listActiveFeaturedListings() {
    return this.featured.listActiveFeaturedListings();
  }
}
