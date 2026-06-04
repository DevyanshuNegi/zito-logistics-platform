# ZITO Phase 1 Revenue Streams Implementation
## PRD Updates for Money Machine Architecture

**Document Purpose:** Synchronized updates to ZITO PRD v10 ULTIMATE reflecting Phase 1 feature implementations

**Date:** May 28, 2026  
**Phase:** 1 (Months 1-3, KES 400M/month by Month 6)  
**Status:** In Progress

---

## Executive Summary

This document updates the ZITO PRD with Phase 1 revenue stream implementations:

1. **Subscription Tiers** (Revenue Stream #2) - Recurring driver tier billing
2. **Featured Listings** (Revenue Stream #3) - Premium load visibility marketplace
3. **Verification Fees** (Revenue Stream #4) - Expedited KYC processing

Together these generate **KES 400M/month revenue by Month 6** through the "Money Machine" multi-stream approach.

---

## Section 1: Subscription Tiers (Revenue Stream #2)

### Product Overview

**What it is:** Driver membership program with 4 tiers offering progressive feature access

**Tiers:**
- **FREE** (Default): 10 loads/day visibility, basic features
- **SILVER** (KES 2,000/month): 50 loads/day, load history, visible ratings
- **GOLD** (KES 5,000/month): Unlimited loads, corporate loads, priority dispatch, analytics
- **PLATINUM** (KES 10,000/month): VIP exclusive loads, guaranteed matching, dedicated support

### Revenue Model

**Per-Driver Monthly Revenue:**
- Assume: 10,000 registered drivers by Month 6
- Subscription penetration: 40% (4,000 drivers upgrading)
- Average tier: SILVER (KES 2,000) + GOLD (KES 5,000) + PLATINUM (KES 10,000) = Weighted ~KES 4,500
- Revenue: 4,000 × KES 4,500 = **KES 18M/month**

**Expansion Path:**
- Month 1: 20% penetration = KES 9M
- Month 2: 30% penetration = KES 13.5M
- Month 3: 40% penetration = KES 18M
- Month 6: 50% penetration = KES 22.5M (baseline, scales with driver growth)

### Implementation Details

**Architecture:**
- Module: `backend/src/modules/subscriptions/`
- Models: `Subscription`, `SubscriptionCharge` (Prisma)
- Enums: `SubscriptionTier` (FREE/SILVER/GOLD/PLATINUM), `SubscriptionStatus` (ACTIVE/PENDING_PAYMENT/SUSPENDED/CANCELLED)

**Database Schema:**
```prisma
model Subscription {
  id                String              @id @default(uuid())
  userId            String              @unique
  tier              SubscriptionTier    @default(FREE)
  monthlyPrice      Int                 // KES * 100
  status            SubscriptionStatus  @default(ACTIVE)
  
  startDate         DateTime
  nextBillingDate   DateTime            // 30 days from subscription start
  
  autoRenew         Boolean             @default(true)
  failedAttempts    Int                 @default(0)
  
  charges           SubscriptionCharge[]
  
  createdAt         DateTime
  updatedAt         DateTime
}

model SubscriptionCharge {
  id                    String                    @id
  subscriptionId        String
  subscription          Subscription
  
  amount                Int                       // KES * 100
  chargedDate           DateTime
  status                SubscriptionChargeStatus  // SUCCESSFUL/FAILED/PENDING
  transactionReference  String?
  failureReason         String?
}
```

**Billing Logic:**
1. **Signup:** Driver selects tier → Immediate charge to wallet
2. **Monthly Renewal:** 5th day each month (or 30 days from signup)
3. **Payment Retry:** On failure, retry up to 3 times
4. **Suspension:** After 3 failed payments → Suspend subscription
5. **Resume:** Driver can retry payment to reactivate

**Endpoints:**
- `GET /subscriptions/tiers` - List all tiers with pricing
- `POST /subscriptions` - Create/upgrade subscription (auto-charges)
- `GET /subscriptions/current` - Get driver's current tier
- `DELETE /subscriptions/:id` - Cancel subscription
- `POST /subscriptions/:id/resume` - Resume after suspension
- `POST /subscriptions/:id/charge` - Manual charge (testing/admin)

**Feature Access Control:**
```typescript
// Used by: Bookings/Marketplace modules
await subscriptions.getLoadsVisibilityCount(userId) // Returns: 10, 50, 999, 999
await subscriptions.hasFeatureAccess(userId, 'corporate_loads') // Returns: boolean
```

**Messaging & Notifications:**
- Tier upgrade success → SMS + push notification
- Billing reminder → 3 days before renewal
- Payment failed → SMS with retry instructions + due date (+2 days)
- Subscription suspended → SMS with reactivation link
- Subscription resumed → SMS confirmation

### Operational Requirements

**Cron Jobs:**
- `@Cron('0 2 * * *')` - Daily billing cycle check
- Processes all subscriptions due for renewal
- Handles retries + suspensions
- Logs all charges to audit trail

**Monitoring Metrics:**
- Active subscriptions by tier
- Monthly churn rate
- Failed payment retry rate
- Average revenue per driver (ARPD)

---

## Section 2: Featured Listings (Revenue Stream #3)

### Product Overview

**What it is:** Premium marketplace visibility for loads/bookings (similar to "Promote" on Airbnb)

**Tiers:**
- **FEATURED** (KES 500/day, 1-3 days): Golden star badge, appears in "Featured" section
- **PREMIUM** (KES 1,000/day, 4-7 days): Purple badge, top of search results, priority matching
- **VIP** (KES 5,000/month): Unlimited featured loads, dedicated matching support, analytics dashboard

### Revenue Model

**Per-Month Revenue Calculation:**
- Assume: 100,000 active bookings/month
- Featured adoption rate: 2% = 2,000 featured bookings/month
- Average duration: 3 days (FEATURED tier)
- Revenue per booking: KES 1,500 (3 days × KES 500/day)
- Total: 2,000 × KES 1,500 = **KES 300M/month**

**Expansion Path (requires scale):**
- Month 1: 500 featured/month × KES 1,500 = KES 750K
- Month 3: 1,500 featured/month × KES 1,500 = KES 2.25M
- Month 6: 3,000 featured/month × KES 1,500 = KES 4.5M (baseline for KES 400M target)

*Note: Needs 8-10x scale via shipper growth + agent recruitment*

### Implementation Details

**Architecture:**
- Module: `backend/src/modules/marketplace/`
- New Service: `FeaturedListingsService`
- Models: `FeaturedListing` (Prisma)
- Enums: `FeaturedListingTier`, `FeaturedListingStatus`

**Database Schema:**
```prisma
model FeaturedListing {
  id                    String                  @id @default(uuid())
  bookingId             String                  @unique
  booking               Booking
  
  tier                  FeaturedListingTier     // FEATURED/PREMIUM/VIP
  status                FeaturedListingStatus   // ACTIVE/EXPIRED/CANCELLED
  
  startDate             DateTime
  expiryDate            DateTime
  durationDays          Int
  
  totalCost             Int                     // KES * 100
  transactionReference  String?
}

// Added to Booking model:
isFeatured            Boolean         @default(false)
featuredTier          FeaturedListingTier?
```

**Purchase Flow:**
1. Shipper posts load/booking
2. Clicks "Make Featured" button
3. Selects tier (FEATURED/PREMIUM/VIP)
4. Enters duration (1-30 days, tier-specific limits)
5. System calculates: `totalCost = tier.pricePerDay × durationDays`
6. Deduct from wallet (or M-Pesa checkout if insufficient balance)
7. Create FeaturedListing record
8. Add badge to booking metadata
9. Featured loads appear at top of search results

**Endpoints:**
- `GET /marketplace/featured/pricing` - List pricing tiers
- `POST /marketplace/featured` - Purchase featured listing
- `GET /marketplace/featured/:id` - Get featured listing details
- `POST /marketplace/featured/:id/extend` - Extend duration + re-charge
- `DELETE /marketplace/featured/:id` - Cancel (refund if within 24 hours)
- `GET /marketplace/featured` - List active featured (for search ranking)

**Search Integration:**
```typescript
// Used by: Marketplace search endpoint
const featuredListings = await featured.listActiveFeaturedListings();
// Returns featured bookings sorted by tier (VIP → PREMIUM → FEATURED)
// Search results: Featured loads appear first, then regular loads
```

**Auto-Expiry:**
- Cron job runs daily: expireOutdatedListings()
- Marks expired featured listings
- Removes badges from bookings
- No refund (usage-based pricing)

**Refund Policy:**
- Within 24 hours: 100% refund to wallet
- After 24 hours: No refund

### Operational Requirements

**Metrics to Track:**
- Featured listings purchased by tier
- Average listing duration
- Conversion: Featured → Completed booking
- Revenue per featured listing

---

## Section 3: Verification Fees (Revenue Stream #4)

### Product Overview

**What it is:** Premium KYC (Know Your Customer) processing - monetizing fast-track verification

**Processing Modes:**
- **Standard (FREE)**: 7-10 business days, automatic review
- **Expedited (PAID)**: 24 hours, priority processing, **KES 500 fee**

### Revenue Model

**Per-Month Revenue Calculation:**
- Assume: 5,000 new drivers/month sign up
- Expedited uptake: 30% = 1,500 drivers
- Revenue per driver: KES 500
- Total: 1,500 × KES 500 = **KES 750K/month**

**Expansion Path:**
- Month 1: 1,000 expedited × KES 500 = KES 500K
- Month 3: 1,500 expedited × KES 500 = KES 750K
- Month 6: 2,500 expedited × KES 500 = KES 1.25M (baseline)

*Note: Scales with driver onboarding velocity*

### Implementation Details

**Architecture:**
- Module: `backend/src/modules/audit/`
- New Service: `VerificationFeeService`
- Models: `VerificationFeePayment`, `VerificationCertificate` (Prisma)

**Database Schema:**
```prisma
model VerificationFeePayment {
  id                        String    @id @default(uuid())
  userId                    String
  user                      User
  
  amount                    Int       // KES * 100 = 50000 (KES 500)
  processingMode            String    // STANDARD/EXPEDITED
  status                    String    // PAID/COMPLETED/REFUNDED
  
  paidAt                    DateTime
  completedAt               DateTime?
  expectedCompletionDate    DateTime? // Now + 24 hours for EXPEDITED
  
  transactionReference      String?
}

model VerificationCertificate {
  id                    String    @id @default(uuid())
  userId                String
  user                  User
  
  certificateNumber     String    @unique
  status                String    // ACTIVE/EXPIRED/REVOKED
  
  issuedAt              DateTime
  expiresAt             DateTime  // 1 year from issue
}
```

**User Journey:**
1. Driver submits KYC documents via app (existing flow)
2. Gets message: "Standard verification: 7-10 days" OR "Expedite for KES 500 (24 hours)"
3. Clicks "Expedite" → Deduct KES 500 from wallet
4. Document status: PENDING → UNDER_REVIEW (priority queue)
5. Expected completion: Now + 24 hours (vs. 7-10 days)
6. On approval: Certificate issued + "Verified" badge appears
7. Certificate expires: 1 year from issue (auto-renewal available)

**Endpoints:**
- `GET /verification/pricing` - Show pricing + processing times
- `GET /verification/status` - Check current verification status + certificate
- `POST /verification/expedite` - Request expedited processing (KES 500 charge)
- `POST /verification/approve` - Admin: approve verification + issue certificate
- `POST /verification/reject` - Admin: reject + refund expedited fee

**Refund Logic:**
- If verification rejected: Full refund of expedited fee
- If user re-submits same tier: Must pay again
- Grace period: 30 days to resubmit after rejection

### Operational Requirements

**Admin Dashboard (TBD):**
- Queue of pending verifications (prioritize paid expedited)
- Bulk approve/reject
- Certificate issuance tracking
- Revenue reporting by processing mode

---

## Section 4: Combined Phase 1 Revenue Model

### 5-Month Ramp (Month 1 → Month 6)

| Metric | Month 1 | Month 2 | Month 3 | Month 4 | Month 5 | Month 6 (Target) |
|--------|---------|---------|---------|---------|---------|------------------|
| **Subscriptions** | KES 2M | KES 5M | KES 8M | KES 12M | KES 16M | KES 22.5M |
| **Featured** | KES 750K | KES 1.5M | KES 2.25M | KES 3M | KES 3.75M | KES 4.5M |
| **Verification Fees** | KES 500K | KES 750K | KES 750K | KES 1M | KES 1.25M | KES 1.25M |
| **Total Phase 1** | **KES 3.25M** | **KES 7.25M** | **KES 11M** | **KES 16M** | **KES 21M** | **KES 28.25M** |

### Scaling to KES 400M/Month Target

**Phase 1 baseline (Month 6): KES 28.25M**  
**Target for Month 6: KES 400M**  
**Gap: KES 371.75M**

**Strategy to close gap:**

1. **Scale Subscriptions (Biggest Impact):**
   - Increase driver base: 10K → 50K drivers
   - Increase penetration: 40% → 60%
   - Target revenue: KES 300M/month by Month 6
   - Requires: Agent network + marketing focus

2. **Launch Phase 2 Streams (Month 2-3):**
   - SMS Metering (KES 50M/month) - Already implemented
   - Agent Commission Tracking (KES 20M/month) - Month 3
   - These add incremental revenue

3. **Shipper Growth:**
   - Featured listings scale with shipper volume
   - Verification fees scale with driver onboarding
   - Both depend on platform adoption velocity

### Phase 1 Implementation Timeline

| Week | Deliverable | Status |
|------|-------------|--------|
| Week 1 | Subscriptions module complete + Prisma migrations | ✅ DONE |
| Week 1 | Featured listings service + controller | ✅ DONE |
| Week 1 | Verification fees service + controller | ✅ DONE |
| Week 2 | Frontend: Subscription tier selection UI | TODO |
| Week 2 | Frontend: Featured listing purchase modal | TODO |
| Week 2 | Frontend: Verification expedite button | TODO |
| Week 3 | Wallet integration testing (all 3 streams) | TODO |
| Week 3 | SMS notification templates finalized | TODO |
| Week 4 | UAT with 50-driver pilot group | TODO |
| Week 5 | Live beta with 500 drivers | TODO |
| Week 6 | Full production launch | TODO |

---

## Section 5: Technical Integration Points

### Payments Integration

All three streams integrate with existing `PaymentsService`:

```typescript
// Subscriptions
await payments.deductFromWallet(userId, {
  amount: subscription.monthlyPrice,
  type: 'SUBSCRIPTION_CHARGE',
  description: 'Monthly subscription',
  reference: `SUB-${subscriptionId}`,
});

// Featured listings
await payments.deductFromWallet(userId, {
  amount: totalCost,
  type: 'FEATURED_LISTING_PURCHASE',
  description: 'Featured listing purchase',
  reference: `FEAT-${bookingId}`,
});

// Verification fees
await payments.deductFromWallet(userId, {
  amount: 50000, // KES 500
  type: 'VERIFICATION_FEE',
  description: 'Expedited verification',
  reference: `VER-FEE-${userId}`,
});
```

### Notifications Integration

All three streams send SMS notifications via `NotificationsService`:

**Subscriptions:**
- upgrade_success, billing_reminder, payment_failed, suspended, resumed

**Featured Listings:**
- featured_purchased, featured_expiring, featured_extended, featured_cancelled

**Verification Fees:**
- expedited_paid, expedited_approved, expedited_rejected

### Feature Access Control

Subscriptions module provides helpers for other modules:

```typescript
// Bookings module: Limit visible loads based on tier
const loadsPerDay = await subscriptions.getLoadsVisibilityCount(driverId);
bookings = bookings.slice(0, loadsPerDay);

// Marketplace module: Show corporate loads only to Gold+ subscribers
const hasAccess = await subscriptions.hasFeatureAccess(driverId, 'corporate_loads');
if (hasAccess) {
  results.push(corporateLoads);
}
```

### Marketplace Search Integration

Featured listings appear first in search results:

```typescript
// In marketplace search endpoint:
const featured = await featured.listActiveFeaturedListings();
const regular = await bookings.search(query, { excludeIds: featured.map(f => f.bookingId) });

return {
  featured: featured.map(f => ({...f.booking, featured: f.tier})),
  regular: regular,
};
```

---

## Section 6: PRD Sections to Update/Add

**To be added/modified in ZITO PRD v10 ULTIMATE:**

### New Section: Revenue Model - Phase 1 Monetization

**Location:** After current Section 55 (Revenue Model - 30 Streams)

**Content:**
- Phase 1 Money Machine architecture
- Subscription tiers detailed spec
- Featured listings marketplace mechanics
- Verification fees + certificate system
- Combined revenue projections
- Scaling path to KES 400M/month

### Modified Section: Feature Matrix

**Location:** Sections 40-50 (Feature reference)

**Changes:**
- Mark subscriptions as "Phase 1 - Implemented Week 1"
- Mark featured listings as "Phase 1 - Implemented Week 1"
- Mark verification fees as "Phase 1 - Implemented Week 1"

### New Section: Operational Dashboards

**Location:** Section 60+ (Operations)

**Content:**
- Revenue tracking dashboard (by stream)
- Subscription management (churn, upgrades, suspensions)
- Featured listings analytics (conversion, ROI)
- Verification processing queue

---

## Section 7: Sync Notes

**How PRD is kept in sync with code:**

1. **This document** is committed to: `docs/prd/PHASE_1_REVENUE_IMPLEMENTATION.md`
2. **Backend modules** reference this document in their README
3. **Every implementation** updates both code + PRD in same PR
4. **Quarterly reviews** reconcile PRD with actual metrics

---

## Next Steps (June Implementation)

1. ✅ **Week 1 (Done):** Backend modules + Prisma schema
2. **Week 2:** Frontend UI components
3. **Week 3:** End-to-end integration testing
4. **Week 4-5:** Pilot + beta testing
5. **Week 6:** Production launch

---

**Document Version:** 1.0  
**Last Updated:** May 28, 2026  
**Next Review:** June 28, 2026
