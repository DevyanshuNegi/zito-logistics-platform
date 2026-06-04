import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto, SubscriptionTierDto } from './subscriptions.dto';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron } from '@nestjs/schedule';

/**
 * PHASE 1 REVENUE STREAM #2: Driver Subscription Tiers
 * 
 * Revenue Model:
 * - Free: 10 loads/day visible, limited features (baseline)
 * - Silver: KES 2,000/month - 50 loads/day, load history, ratings visible
 * - Gold: KES 5,000/month - All loads, premium corporate loads, analytics
 * - Platinum: KES 10,000/month - VIP exclusive loads, priority support, advanced analytics
 * 
 * Monetization:
 * - Monthly recurring charge (5th day of month, or 30 days from signup)
 * - Auto-suspend on 3 failed payment attempts
 * - Auto-renew with 7-day grace period
 * 
 * Critical for Phase 1: Must launch Month 2 to hit KES 400M revenue target
 */

export enum SubscriptionTier {
  FREE = 'FREE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export interface SubscriptionConfig {
  tier: SubscriptionTier;
  monthlyPrice: number; // KES
  loadsPerDay: number;
  features: string[];
  supportLevel: 'basic' | 'priority' | 'vip';
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger('SubscriptionsService');

  private readonly tierConfigs: Record<SubscriptionTier, SubscriptionConfig> = {
    [SubscriptionTier.FREE]: {
      tier: SubscriptionTier.FREE,
      monthlyPrice: 0,
      loadsPerDay: 10,
      features: ['basic_matching', 'load_viewing', 'ratings_view'],
      supportLevel: 'basic',
    },
    [SubscriptionTier.SILVER]: {
      tier: SubscriptionTier.SILVER,
      monthlyPrice: 2000,
      loadsPerDay: 50,
      features: ['basic_matching', 'load_history', 'ratings_visible', 'earnings_analytics'],
      supportLevel: 'basic',
    },
    [SubscriptionTier.GOLD]: {
      tier: SubscriptionTier.GOLD,
      monthlyPrice: 5000,
      loadsPerDay: 999, // unlimited
      features: [
        'advanced_matching',
        'corporate_loads',
        'priority_dispatch',
        'full_analytics',
        'fuel_tracking',
        'performance_score',
      ],
      supportLevel: 'priority',
    },
    [SubscriptionTier.PLATINUM]: {
      tier: SubscriptionTier.PLATINUM,
      monthlyPrice: 10000,
      loadsPerDay: 999, // unlimited
      features: [
        'vip_exclusive_loads',
        'guaranteed_matching',
        'priority_dispatch',
        'advanced_analytics',
        'dedicated_support',
        'fuel_card_integration',
        'insurance_discounts',
      ],
      supportLevel: 'vip',
    },
  };

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Create or upgrade a subscription
   * PHASE 1: Driver upgrades to Silver/Gold/Platinum
   */
  async createSubscription(userId: string, dto: CreateSubscriptionDto) {
    // Validate tier
    if (!Object.values(SubscriptionTier).includes(dto.tier as SubscriptionTier)) {
      throw new BadRequestException('Invalid subscription tier');
    }

    const tier = dto.tier as SubscriptionTier;
    const config = this.tierConfigs[tier];

    // Check if user already has active subscription
    const existing = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING_PAYMENT] },
      },
    });

    if (existing) {
      // If upgrading/downgrading, cancel old and create new
      await this.cancelSubscription(existing.id, 'UPGRADE');
    }

    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        tier,
        monthlyPrice: config.monthlyPrice,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        nextBillingDate: this.calculateNextBillingDate(),
        autoRenew: true,
        paymentMethod: dto.paymentMethod || 'MPESA',
      },
    });

    // If not FREE tier, charge immediately
    if (tier !== SubscriptionTier.FREE) {
      await this.chargeSubscription(subscription.id);
      const chargedSubscription = await this.prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      if (chargedSubscription?.status !== SubscriptionStatus.ACTIVE) {
        const failedCharge = await this.prisma.subscriptionCharge.findFirst({
          where: { subscriptionId: subscription.id, status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
        });

        throw new HttpException(
          failedCharge?.failureReason
            ? `Subscription payment failed: ${failedCharge.failureReason}`
            : 'Subscription payment failed. Add wallet balance and retry.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      await this.notifications.sendSms(userId, {
        template: 'SUBSCRIPTION_UPGRADE',
        tier,
        price: config.monthlyPrice,
      });

      return chargedSubscription;
    }

    // Send welcome notification
    await this.notifications.sendSms(userId, {
      template: 'SUBSCRIPTION_UPGRADE',
      tier,
      price: config.monthlyPrice,
    });

    return subscription;
  }

  /**
   * Charge a single subscription (called during signup or on billing date)
   */
  async chargeSubscription(subscriptionId: string, retryAttempt = 0) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.tier === SubscriptionTier.FREE) {
      return; // No charge for FREE tier
    }

    try {
      // Deduct from driver wallet
      const walletTransaction = await this.payments.deductFromWallet(subscription.userId, {
        amount: subscription.monthlyPrice,
        type: 'SUBSCRIPTION_CHARGE',
        description: `Monthly ${subscription.tier} subscription`,
        reference: `SUB-${subscriptionId}`,
      });

      // Record charge
      await this.prisma.subscriptionCharge.create({
        data: {
          subscriptionId,
          amount: subscription.monthlyPrice,
          chargedDate: new Date(),
          status: 'SUCCESSFUL',
          transactionReference: walletTransaction.id,
        },
      });

      // Update next billing date
      const nextBillingDate = this.calculateNextBillingDate(subscription.nextBillingDate);
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          nextBillingDate,
          status: SubscriptionStatus.ACTIVE,
          failedAttempts: 0,
        },
      });

      this.logger.log(`Charged subscription ${subscriptionId}: KES ${subscription.monthlyPrice}`);
    } catch (error) {
      // Handle payment failure with retry logic
      await this.handlePaymentFailure(subscriptionId, retryAttempt, error);
    }
  }

  /**
   * Handle payment failure - retry 3 times, then suspend
   */
  private async handlePaymentFailure(subscriptionId: string, retryAttempt: number, error: any) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    const newFailureCount = (subscription?.failedAttempts || 0) + 1;

    if (newFailureCount >= 3) {
      // Suspend subscription after 3 failures
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.SUSPENDED,
          failedAttempts: newFailureCount,
        },
      });

      // Send suspension notification
      await this.notifications.sendSms(subscription.userId, {
        template: 'SUBSCRIPTION_SUSPENDED',
        reason: 'Payment failed 3 times',
        tier: subscription.tier,
      });

      this.logger.warn(`Subscription ${subscriptionId} suspended after 3 failed payments`);
    } else {
      // Update failure count, retry in 2 days
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.PENDING_PAYMENT,
          failedAttempts: newFailureCount,
          nextBillingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // +2 days
        },
      });

      await this.notifications.sendSms(subscription.userId, {
        template: 'SUBSCRIPTION_PAYMENT_FAILED',
        attempt: newFailureCount,
        nextAttempt: this.formatDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
      });

      this.logger.warn(`Subscription ${subscriptionId} payment failed (attempt ${newFailureCount}/3)`);
    }

    // Record failed charge
    await this.prisma.subscriptionCharge.create({
      data: {
        subscriptionId,
        amount: subscription.monthlyPrice,
        chargedDate: new Date(),
        status: 'FAILED',
        failureReason: error.message,
      },
    });
  }

  /**
   * Monthly cron job: Charge all active subscriptions on billing date
   * CRITICAL: Must run reliably every month
   */
  @Cron('0 2 * * *') // 2 AM UTC daily (charges run if date matches)
  async processMonthlyBilling() {
    this.logger.log('Starting monthly subscription billing cycle');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find all subscriptions due for billing today
    const dueBillings = await this.prisma.subscription.findMany({
      where: {
        autoRenew: true,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING_PAYMENT] },
        nextBillingDate: {
          lte: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Today or tomorrow
        },
      },
    });

    this.logger.log(`Found ${dueBillings.length} subscriptions due for billing`);

    for (const subscription of dueBillings) {
      try {
        await this.chargeSubscription(subscription.id);
      } catch (error) {
        this.logger.error(`Failed to charge subscription ${subscription.id}:`, error);
      }
    }

    this.logger.log('Monthly billing cycle complete');
  }

  /**
   * Get subscription with access controls
   */
  async getSubscription(subscriptionId: string, userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || subscription.userId !== userId) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  /**
   * Get current subscription for user
   */
  async getCurrentSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  /**
   * Get tier configuration
   */
  async getTierInfo(tier: SubscriptionTier) {
    return this.tierConfigs[tier];
  }

  /**
   * List all tiers with pricing
   */
  async listTiers(): Promise<SubscriptionConfig[]> {
    return Object.values(this.tierConfigs);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, reason: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledDate: new Date(),
        cancelReason: reason,
        autoRenew: false,
      },
    });

    await this.notifications.sendSms(subscription.userId, {
      template: 'SUBSCRIPTION_CANCELLED',
      tier: subscription.tier,
      reason,
    });
  }

  /**
   * Resume suspended subscription (after payment)
   */
  async resumeSubscription(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Subscription is not suspended');
    }

    // Attempt payment
    await this.chargeSubscription(subscriptionId);

    // If successful, will update to ACTIVE
    const updated = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    return updated;
  }

  /**
   * Helper: Calculate next billing date (30 days from now or specific date)
   */
  private calculateNextBillingDate(fromDate?: Date): Date {
    const date = fromDate || new Date();
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 30);
    return nextDate;
  }

  /**
   * Helper: Format date for display
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  /**
   * Get driver's available loads based on subscription tier
   * Used by: Bookings/Marketplace module to filter visibility
   */
  async getLoadsVisibilityCount(userId: string): Promise<number> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription) {
      // Default to FREE tier limits
      return this.tierConfigs[SubscriptionTier.FREE].loadsPerDay;
    }

    return this.tierConfigs[subscription.tier].loadsPerDay;
  }

  /**
   * Check if user has feature access (for premium features)
   */
  async hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      // FREE tier features only
      return this.tierConfigs[SubscriptionTier.FREE].features.includes(feature);
    }

    return this.tierConfigs[subscription.tier].features.includes(feature);
  }
}
