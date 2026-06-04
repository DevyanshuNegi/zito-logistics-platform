import { Injectable, BadRequestException, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PurchaseFeaturedListingDto, FeaturedListingTier, FeaturedListingPricingDto } from './dto/featured-listing.dto';

/**
 * PHASE 1 REVENUE STREAM #3: Featured Listings
 * 
 * How it works:
 * 1. User (shipper) posts a load/booking
 * 2. User clicks "Featured" button to upgrade visibility
 * 3. Choose tier (FEATURED, PREMIUM, VIP)
 * 4. Choose duration (1-30 days)
 * 5. Deduct from wallet or M-Pesa checkout
 * 6. Badge appears on load in marketplace (golden star, purple premium, etc.)
 * 7. Featured loads appear at top of search results
 * 8. Auto-expire when duration ends
 * 
 * Revenue Model:
 * - FEATURED: KES 500/day (1-3 days) = KES 500-1,500 per listing
 * - PREMIUM: KES 1,000/day (4-7 days) = KES 4,000-7,000 per listing
 * - VIP: KES 5,000/month (featured + priority support)
 * 
 * Monthly Potential: 
 * - Assume 300 featured loads/month at average KES 1,500 = KES 450,000
 * - Platform revenue: 100% commission = KES 450,000 (Phase 1 target: KES 150M)
 * - Needs: Scale to 1,000+ loads/month by Month 6
 */

export enum FeaturedListingStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

type FeaturedActor = {
  id: string;
  role?: string | null;
  agencyId?: string | null;
};

@Injectable()
export class FeaturedListingsService {
  private readonly logger = new Logger('FeaturedListingsService');

  private readonly pricingConfig: Record<FeaturedListingTier, FeaturedListingPricingDto> = {
    [FeaturedListingTier.FEATURED]: {
      tier: FeaturedListingTier.FEATURED,
      pricePerDay: 50000, // KES 500 in cents
      minDays: 1,
      maxDays: 3,
      description: '1-3 days featured visibility',
    },
    [FeaturedListingTier.PREMIUM]: {
      tier: FeaturedListingTier.PREMIUM,
      pricePerDay: 100000, // KES 1,000 in cents
      minDays: 4,
      maxDays: 7,
      description: '4-7 days premium visibility + priority support',
    },
    [FeaturedListingTier.VIP]: {
      tier: FeaturedListingTier.VIP,
      pricePerDay: 166667, // ~KES 5,000/month (30 days)
      minDays: 30,
      maxDays: 30,
      description: 'Monthly VIP: unlimited loads, priority support, analytics',
    },
  };

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Purchase featured listing
   * PHASE 1: Shipper clicks "Make Featured" → Tier selection → Payment → Badge appears
   * 
   * Flow:
   * 1. Validate booking exists and user owns it
   * 2. Validate duration is within tier limits
   * 3. Calculate total cost
   * 4. Deduct from wallet
   * 5. Create FeaturedListing record
   * 6. Add badge to booking metadata
   * 7. Return featured listing details
   * 
   * Error Cases:
   * - Booking not found: 404
   * - Duration out of range: 400
   * - Insufficient wallet: 402
   */
  async purchaseFeaturedListing(userId: string, dto: PurchaseFeaturedListingDto) {
    const pricing = this.pricingConfig[dto.tier];

    // Validate duration
    if (dto.durationDays < pricing.minDays || dto.durationDays > pricing.maxDays) {
      throw new BadRequestException(
        `Duration must be between ${pricing.minDays} and ${pricing.maxDays} days for ${dto.tier} tier`,
      );
    }

    // Check if booking exists and belongs to user
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: { id: true, customerId: true, agencyId: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertBookingScope({ id: userId }, booking);

    // Check if already featured (prevent double-charging)
    const existingFeatured = await this.prisma.featuredListing.findFirst({
      where: {
        bookingId: dto.bookingId,
        status: FeaturedListingStatus.ACTIVE,
      },
    });

    if (existingFeatured) {
      throw new BadRequestException('This booking is already featured. Cancel it first to upgrade.');
    }

    // Calculate total cost
    const totalCost = pricing.pricePerDay * dto.durationDays;

    // Deduct from wallet
    try {
      const transaction = await this.payments.deductFromWallet(userId, {
        amount: totalCost,
        type: 'FEATURED_LISTING_PURCHASE',
        description: `${dto.tier} featured listing for ${dto.durationDays} days`,
        reference: `FEAT-${dto.bookingId.slice(0, 8)}`,
      });

      // Create featured listing record
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + dto.durationDays);

      const featuredListing = await this.prisma.featuredListing.create({
        data: {
          bookingId: dto.bookingId,
          tier: dto.tier,
          status: FeaturedListingStatus.ACTIVE,
          startDate: new Date(),
          expiryDate,
          durationDays: dto.durationDays,
          totalCost,
          transactionReference: transaction.id,
        },
      });

      // Update booking with featured badge metadata
      await this.prisma.booking.update({
        where: { id: dto.bookingId },
        data: {
          isFeatured: true,
          featuredTier: dto.tier,
        },
      });

      // Send confirmation SMS
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      await this.notifications.sendSms(userId, {
        template: 'FEATURED_LISTING_PURCHASED',
        tier: dto.tier,
        expiryDate: expiryDate.toLocaleDateString('en-KE'),
        cost: `KES ${(totalCost / 100).toLocaleString('en-KE')}`,
      });

      this.logger.log(
        `Featured listing purchased: ${featuredListing.id} - ${dto.tier} for KES ${totalCost / 100}`,
      );

      return featuredListing;
    } catch (error) {
      if (error.message?.includes('Insufficient balance')) {
        throw new BadRequestException(
          `Insufficient wallet balance. Need KES ${(totalCost / 100).toLocaleString('en-KE')}`,
        );
      }
      throw error;
    }
  }

  /**
   * Cancel featured listing and refund if within 24 hours
   */
  async cancelFeaturedListing(featuredListingId: string, userId: string): Promise<void> {
    const featured = await this.prisma.featuredListing.findUnique({
      where: { id: featuredListingId },
      include: { booking: { select: { id: true, customerId: true, agencyId: true } } },
    });

    if (!featured) {
      throw new NotFoundException('Featured listing not found');
    }

    this.assertBookingScope({ id: userId }, featured.booking);

    // Determine if refund eligible (within 24 hours of purchase)
    const hoursSincePurchase =
      (Date.now() - featured.startDate.getTime()) / (1000 * 60 * 60);
    const refundAmount = hoursSincePurchase <= 24 ? featured.totalCost : 0;

    // Update status
    await this.prisma.featuredListing.update({
      where: { id: featuredListingId },
      data: {
        status: FeaturedListingStatus.CANCELLED,
      },
    });

    // Remove badge from booking
    await this.prisma.booking.update({
      where: { id: featured.bookingId },
      data: {
        isFeatured: false,
        featuredTier: null,
      },
    });

    // Issue refund if eligible
    if (refundAmount > 0) {
      await this.payments.refundToWallet(userId, {
        amount: refundAmount,
        type: 'FEATURED_LISTING_REFUND',
        description: 'Refund for cancelled featured listing',
        reference: `FEAT-REF-${featuredListingId.slice(0, 8)}`,
      });

      await this.notifications.sendSms(userId, {
        template: 'FEATURED_LISTING_REFUNDED',
        amount: `KES ${(refundAmount / 100).toLocaleString('en-KE')}`,
      });
    }

    this.logger.log(`Featured listing cancelled: ${featuredListingId}`);
  }

  /**
   * Extend featured listing duration
   * User can extend if currently active
   */
  async extendFeaturedListing(
    featuredListingId: string,
    userId: string,
    additionalDays: number,
  ) {
    const featured = await this.prisma.featuredListing.findUnique({
      where: { id: featuredListingId },
      include: { booking: { select: { id: true, customerId: true, agencyId: true } } },
    });

    if (!featured) {
      throw new NotFoundException('Featured listing not found');
    }

    this.assertBookingScope({ id: userId }, featured.booking);

    if (featured.status !== FeaturedListingStatus.ACTIVE) {
      throw new BadRequestException('Only active featured listings can be extended');
    }

    const pricing = this.pricingConfig[featured.tier];
    const extensionCost = pricing.pricePerDay * additionalDays;

    // Deduct from wallet
    await this.payments.deductFromWallet(userId, {
      amount: extensionCost,
      type: 'FEATURED_LISTING_EXTENSION',
      description: `Extension for ${featured.tier} featured listing`,
      reference: `FEAT-EXT-${featuredListingId.slice(0, 8)}`,
    });

    // Extend expiry date
    const newExpiryDate = new Date(featured.expiryDate);
    newExpiryDate.setDate(newExpiryDate.getDate() + additionalDays);

    const updated = await this.prisma.featuredListing.update({
      where: { id: featuredListingId },
      data: {
        expiryDate: newExpiryDate,
        durationDays: featured.durationDays + additionalDays,
        totalCost: featured.totalCost + extensionCost,
      },
    });

    await this.notifications.sendSms(userId, {
      template: 'FEATURED_LISTING_EXTENDED',
      newExpiryDate: newExpiryDate.toLocaleDateString('en-KE'),
    });

    return updated;
  }

  /**
   * Get pricing info for all tiers
   */
  async getPricingTiers(): Promise<FeaturedListingPricingDto[]> {
    return Object.values(this.pricingConfig);
  }

  /**
   * Get featured listing by ID
   */
  async getFeaturedListing(id: string, actor?: FeaturedActor) {
    const listing = await this.prisma.featuredListing.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            status: true,
            customerId: true,
            agencyId: true,
          },
        },
      },
    });
    if (!listing) {
      throw new NotFoundException('Featured listing not found');
    }
    this.assertBookingScope(actor, listing.booking);
    return listing;
  }

  /**
   * List active featured listings
   * Used by: Marketplace search to show featured loads first
   */
  async listActiveFeaturedListings(limit = 50) {
    return this.prisma.featuredListing.findMany({
      where: {
        status: FeaturedListingStatus.ACTIVE,
        expiryDate: { gt: new Date() },
      },
      include: { booking: true },
      orderBy: { tier: 'desc' }, // VIP first, then PREMIUM, then FEATURED
      take: limit,
    });
  }

  /**
   * Cron job: Expire featured listings
   * Runs daily to mark expired listings
   */
  async expireOutdatedListings(): Promise<void> {
    const expired = await this.prisma.featuredListing.updateMany({
      where: {
        status: FeaturedListingStatus.ACTIVE,
        expiryDate: { lte: new Date() },
      },
      data: {
        status: FeaturedListingStatus.EXPIRED,
      },
    });

    // Remove featured badge from bookings
    const expiredListings = await this.prisma.featuredListing.findMany({
      where: { status: FeaturedListingStatus.EXPIRED },
    });

    for (const listing of expiredListings) {
      await this.prisma.booking.updateMany({
        where: { id: listing.bookingId },
        data: { isFeatured: false, featuredTier: null },
      });
    }

    this.logger.log(`Expired ${expired.count} featured listings`);
  }

  private assertBookingScope(
    actor: FeaturedActor | undefined,
    booking: { customerId: string; agencyId?: string | null },
  ) {
    if (!actor) {
      return;
    }

    const role = String(actor.role ?? '').toUpperCase();
    if (['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return;
    }

    if (role === 'AGENCY_STAFF' && actor.agencyId && booking.agencyId === actor.agencyId) {
      return;
    }

    if (booking.customerId === actor.id) {
      return;
    }

    throw new ForbiddenException('You can only manage featured listings for your own bookings.');
  }
}
