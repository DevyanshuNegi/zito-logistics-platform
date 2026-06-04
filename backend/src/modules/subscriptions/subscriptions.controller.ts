import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SubscriptionsService, SubscriptionTier } from './subscriptions.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /**
   * Get available subscription tiers
   * PUBLIC: No auth required for tier listing
   * Response: Array of tiers with pricing and features
   */
  @Get('tiers')
  async getTiers() {
    return this.subscriptions.listTiers();
  }

  /**
   * Get specific tier details
   * PUBLIC endpoint
   */
  @Get('tiers/:tier')
  async getTierInfo(@Param('tier') tier: string) {
    return this.subscriptions.getTierInfo(tier as SubscriptionTier);
  }

  /**
   * Create/upgrade subscription for current user
   * PHASE 1: Driver clicks "Upgrade" → Tier selection → Payment → Subscription active
   * 
   * Flow:
   * 1. Driver selects tier (Silver/Gold/Platinum)
   * 2. Frontend calls POST /subscriptions with tier
   * 3. Backend charges wallet immediately (or fails if insufficient balance)
   * 4. Returns subscription details
   * 5. Frontend updates UI to show tier features unlocked
   * 
   * Error Cases:
   * - Insufficient wallet balance → 402 Payment Required
   * - Already has active subscription → 409 Conflict (auto-upgrades)
   * - Invalid tier → 400 Bad Request
   */
  @Post()
  @Roles(UserRole.DRIVER)
  async createSubscription(
    @Req() req: any,
    @Body() dto: CreateSubscriptionDto,
  ) {
    const userId = req.user.id;
    return this.subscriptions.createSubscription(userId, dto);
  }

  /**
   * Get current subscription
   * PHASE 1: Used by driver dashboard to show current tier + next billing date
   */
  @Get('current')
  @Roles(UserRole.DRIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getCurrentSubscription(@Req() req: any) {
    const userId = req.user.id;
    const subscription = await this.subscriptions.getCurrentSubscription(userId);

    if (!subscription) {
      return {
        tier: 'FREE',
        status: 'ACTIVE',
        monthlyPrice: 0,
        message: 'On free tier',
      };
    }

    return subscription;
  }

  /**
   * Get specific subscription (for details page)
   */
  @Get(':id')
  @Roles(UserRole.DRIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getSubscription(
    @Req() req: any,
    @Param('id') subscriptionId: string,
  ) {
    const userId = req.user.id;
    return this.subscriptions.getSubscription(subscriptionId, userId);
  }

  /**
   * Update subscription settings (e.g., toggle auto-renew)
   * PHASE 1: Driver can disable auto-renewal before next billing
   */
  @Patch(':id')
  @Roles(UserRole.DRIVER)
  async updateSubscription(
    @Req() req: any,
    @Param('id') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    const userId = req.user.id;
    const subscription = await this.subscriptions.getSubscription(subscriptionId, userId);

    // TODO: Implement update logic (will add to service if needed)
    return subscription;
  }

  /**
   * Cancel subscription
   * PHASE 1: Driver clicks "Cancel Subscription" → Downgrade to FREE
   * 
   * Behavior:
   * - Cancels immediately (no refunds)
   * - Driver downgraded to FREE tier
   * - Can resubscribe anytime
   * - Features lock down after cancellation
   */
  @Delete(':id')
  @Roles(UserRole.DRIVER)
  async cancelSubscription(
    @Req() req: any,
    @Param('id') subscriptionId: string,
  ) {
    const userId = req.user.id;
    const subscription = await this.subscriptions.getSubscription(subscriptionId, userId);
    await this.subscriptions.cancelSubscription(subscription.id, 'USER_REQUESTED');

    return { message: 'Subscription cancelled', status: 'CANCELLED' };
  }

  /**
   * Resume suspended subscription (after failed billing)
   * PHASE 1: Driver with suspended subscription can retry payment
   * 
   * Prerequisites:
   * - Subscription status = SUSPENDED
   * - User has sufficient wallet balance
   * 
   * Response:
   * - If charge succeeds: Returns ACTIVE subscription
   * - If charge fails: Returns PENDING_PAYMENT with retry instructions
   */
  @Post(':id/resume')
  @Roles(UserRole.DRIVER)
  async resumeSubscription(
    @Req() req: any,
    @Param('id') subscriptionId: string,
  ) {
    const userId = req.user.id;
    const subscription = await this.subscriptions.getSubscription(subscriptionId, userId);
    return this.subscriptions.resumeSubscription(subscription.id);
  }

  /**
   * Manual charge trigger (admin/testing only)
   * Used for:
   * - Testing payment flows during development
   * - Manual retry for failed charges
   * - Debug scenarios
   * 
   * NOTE: Should be removed or restricted to admin in production
   */
  @Post(':id/charge')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async chargeNow(
    @Req() req: any,
    @Param('id') subscriptionId: string,
  ) {
    const userId = req.user.id;
    const subscription = await this.subscriptions.getSubscription(subscriptionId, userId);
    await this.subscriptions.chargeSubscription(subscription.id);

    const updated = await this.subscriptions.getSubscription(subscription.id, userId);
    return updated;
  }
}
