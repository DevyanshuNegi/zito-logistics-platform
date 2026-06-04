# ZITO Phase 6+: Revenue Streams Implementation Checklist
**Date:** May 28, 2026  
**Purpose:** Module-by-module tasks for implementing all 30 revenue streams  
**Status:** Ready for Sprint Planning

---

## Quick Reference: Revenue Streams by Implementation Quarter

### ✅ Q1 2026 (Minimal - Quick Wins)
- [x] SMS/WhatsApp notification metering
- [x] Verification & KYC fees setup

### 🚀 Q2 2026 (High Priority)
- Driver subscription tiers (recurring billing)
- Pickup & Drop subscriptions
- Featured premium loads/bids
- AI Pricing Engine enhancements
- Escrow transaction fees (UI + dispute flow)

### 🚀 Q3 2026 (Medium Priority - Partnerships)
- Fuel partner system launch
- Cross-border logistics fees
- Agent franchise program
- Fast payment/advance payout
- Route optimization premium (feature gating)
- Predictive maintenance alerts
- Import/Export clearing referral
- API monetization launch
- Ad marketplace launch

### 🚀 Q4 2026 (Lower Priority - Complex)
- Insurance marketplace
- Spare parts marketplace
- Vehicle service booking
- Driver wallet microfinance
- Invoice financing
- Training & certification platform

---

## Module-by-Module Implementation Checklist

### 1. BILLING & PAYMENTS MODULE
**Current Status:** Core invoice and payment system exist  
**Enhancements Needed for Revenue Streams:** 8, 14, 15, 24, 25

#### Sprint Tasks:

**RECURRING BILLING FRAMEWORK (NEW - Dependency for Drivers, Pickup-Drop, Fleet SaaS)**
- [ ] Create `RecurringBillingCycle` table
  - billing_id, customer_id, frequency (MONTHLY, QUARTERLY), amount, status, next_billing_date
- [ ] Create `SubscriptionProduct` table
  - product_id, name, category (DRIVER_TIER, PICKUP_DROP, FLEET_SaaS), base_price
- [ ] Create `SubscriptionInvoice` table
  - invoice_id, subscription_id, billing_cycle, amount, status (PENDING, PAID, FAILED, DISPUTED)
- [ ] Implement `RecurringBillingService`
  - `createSubscription()` - Start recurring billing
  - `processMonthlyBillings()` - Cron job to charge all active subscriptions
  - `handleFailedPayment()` - Retry logic, suspension after 3 failures
  - `cancelSubscription()` - Graceful removal from recurring cycle
  - `upgradeSubscription()` - Pro-rated charges for mid-cycle upgrades
- [ ] Implement payment retry logic (3 retries, exponential backoff)
- [ ] Integrate with M-Pesa for recurring charges
- [ ] Create `/admin/billing/recurring` dashboard

**ESCROW TRANSACTION FEE (Revenue #14 - Enhancement)**
- [ ] Add `escrowFee` field to `BookingInvoice` table (currently exists as `platformCommission`)
- [ ] Calculate escrow fee (1-3% of booking value) separately from commission
- [ ] Display fee breakdown in customer booking preview
- [ ] Create `/customer/bookings/[id]/escrow-details` UI showing:
  - Total amount held in escrow
  - Fee amount (transparent)
  - Release date (after delivery confirmation)
  - Dispute/hold status
- [ ] Implement escrow fund tracking (separate ledger)
  - `EscrowFund` table: amount_held, amount_released, amount_disputed
- [ ] Create dispute handling workflow
  - Admin interface to freeze/release funds on dispute
  - Customer appeal submission
  - Automatic resolution after 7 days if no dispute

**FINTECH PARTNER INTEGRATION (For Revenue #15, #24, #25)**
- [ ] Design fintech partner API contract
  - Instant payout processor (Fast Payment)
  - Microfinance loan origination (Driver Wallet)
  - Invoice advance processor (Invoice Financing)
- [ ] Implement partner adapter pattern
  - `PayoutPartnerInterface` for quick cash-out
  - `LoanOriginationInterface` for micro-loans
  - `InvoiceFinanceInterface` for invoice advances
- [ ] Integrate with Equity Bank Fuliza (or selected partner)
  - Loan application submission
  - Credit score calculation
  - Repayment deduction tracking
- [ ] Create `/driver/wallet/loans` dashboard
  - Loan application form
  - Outstanding loan tracker
  - Repayment schedule
- [ ] Implement automatic repayment deductions from trip earnings

**SMS/WHATSAPP NOTIFICATION METERING (Revenue #28 - Q1)**
- [ ] Add `notificationMetrics` table
  - notification_id, type (SMS/WHATSAPP), customer_id, recipient, cost, billing_date
- [ ] Implement metering logic in `NotificationService`
  - SMS: KES 5/message
  - WhatsApp: KES 10/message
- [ ] Create batch pricing discount calculation
  - 10K SMS/month: KES 40K (vs normal KES 50K) = 20% discount
- [ ] Generate monthly notification invoice (`NOTIFICATION_CHARGES` type)
- [ ] Create `/customer/notifications/usage` showing:
  - SMS usage this month
  - WhatsApp usage this month
  - Cost breakdown
  - Projected monthly cost
- [ ] Implement notification budget alerts (warn at 80%, cap at 100%)

**VERIFICATION FEES (Revenue #13 - Q2)**
- [ ] Create `VerificationService` (in `audit` module)
  - `chargeForVerification()` - Deduct fee from wallet
  - `expediteVerification()` - Priority processing for fee-paying users
  - `generateVerificationCertificate()` - Digital proof
- [ ] Implement fee structure
  - Driver identity: KES 500 (2-hour processing)
  - Driver license: KES 300 (1-hour)
  - Vehicle registration: KES 500 (2-hour)
  - Company verification: KES 2,000 (24-hour)
  - Trust badge (monthly): KES 2,000
  - Insurance verification: KES 1,000
- [ ] Create payment flow in verification workflow
  - Pre-verify check balance
  - Deduct after verification initiated
  - Refund if verification fails
- [ ] Create `/driver/verification/payment` showing available verifications and prices

---

### 2. SUBSCRIPTION & LICENSING MODULE
**Current Status:** Does not exist  
**Dependencies:** Multiple revenue streams (Driver Tiers #2, Fleet SaaS #3, Pickup-Drop #21, Route Optimization #16, Predictive Maintenance #18)

#### Sprint Tasks:

**CREATE NEW MODULE: `subscriptions`**
- [ ] Create `Subscription` table
  - subscription_id, user_id, product_type (ENUM: DRIVER_TIER, FLEET_SaaS, ROUTE_PREMIUM, MAINTENANCE_ALERTS, PICKUP_DROP_SERVICE), tier (FREE/SILVER/GOLD/PLATINUM), start_date, renewal_date, status
- [ ] Create `SubscriptionFeature` table
  - feature_id, subscription_id, feature_name, is_enabled, limit (e.g., max_vehicles, api_calls)
- [ ] Create `SubscriptionUpgrade` table
  - upgrade_id, subscription_id, from_tier, to_tier, proration_amount, upgrade_date

**DRIVER TIER SYSTEM (Revenue #2 - Q2)**
- [ ] Implement driver subscription tiers
  - Free: Limited load visibility, basic app
  - Silver: KES 2,000/month, standard loads, load history
  - Gold: KES 5,000/month, premium corporate loads, analytics
  - Platinum: KES 10,000/month, exclusive loads, priority support
- [ ] Feature gating based on tier
  - Load visibility: Free sees 10/day, Silver 50/day, Gold unlimited, Platinum premium loads first
  - Load quality: Premium shippers' loads only visible in Gold/Platinum
  - Response time: Gold/Platinum get 1-minute priority window before other drivers
  - Features: Gold/Platinum unlock analytics, fuel tracking
- [ ] Subscription UI in driver app
  - Current tier badge (highlighted)
  - Upgrade benefits comparison
  - One-tap subscribe button
  - Cancellation confirmation (remind of benefits lost)
- [ ] Auto-deduct subscription from driver earnings (wallet transaction)
  - Monthly charge on renewal date
  - If insufficient balance, auto-attempt from M-Pesa linked account
  - Suspend tier if payment fails 3 times
- [ ] Create `/transporter/subscriptions` showing
  - Current driver subscription status per driver
  - Tier performance (completion rates, ratings by tier)

**PICKUP & DROP SUBSCRIPTION (Revenue #21 - Q2)**
- [ ] Create `RecurringBookingTemplate` table
  - template_id, customer_id, pickup_location, dropoff_locations (array), schedule (DAILY/WEEKLY/MONTHLY), preferred_time, recurrence_end_date
- [ ] Implement template-based auto-booking
  - Cron: Check templates at 11 PM day before
  - Auto-create booking for next day
  - Lock in pricing from template
  - Auto-assign driver based on SLA
- [ ] Contract generation
  - Monthly contract PDF showing:
    - Route details, stops, pricing
    - Schedule (daily/weekly/monthly)
    - Total commitment + per-trip cost
    - Termination terms
- [ ] Monthly billing
  - Single invoice for all recurring trips (not per-trip)
  - Pro-rated if mid-month start/end
- [ ] UI: `/customer/recurring-bookings`
  - List active templates
  - Create new template (wizard: location → frequency → pricing review)
  - View next 30 days of scheduled bookings
  - Pause/resume/cancel template
  - Modify template (location, time, frequency)

**FLEET OWNER SAAS TIERS (Revenue #3 - Enhancement)**
- [ ] Codify existing SaaS into subscription tiers
  - Free: 5 vehicles max, basic dashboard
  - Silver: KES 5,000/month, 20 vehicles, fuel analytics
  - Gold: KES 15,000/month, unlimited vehicles, predictive alerts, API
  - Platinum: KES 30,000/month, white-label, custom integrations
- [ ] Feature gating
  - Free → Silver: Unlock fuel variance analysis
  - Free → Gold: Unlock predictive alerts, API access
  - Free → Platinum: Unlock white-label, dedicated support
- [ ] Create `/transporter/subscription` showing
  - Current tier
  - Feature comparison (what's locked)
  - Upgrade button
  - Monthly invoice history

---

### 3. MARKETPLACE MODULE
**Current Status:** Marketplace exists (Phase 5)  
**Enhancements Needed:** Premium features, ad system, bid fees, featured loads

#### Sprint Tasks:

**FEATURED LISTINGS (Revenue #29 - Already Live, but ensure monetized)**
- [ ] Confirm `marketplace.isPremium` flag is actively used
- [ ] Verify featured loads appear first in driver search
- [ ] Create `/marketplace/featured` admin portal
  - List all featured opportunities
  - Performance metrics (click-through, bid count)
  - Manual priority ordering for premium tier
- [ ] Implement auto-expiry of featured status after duration expires
- [ ] Create renewal reminder emails/SMS

**FEATURED PREMIUM LOADS/BIDS (Revenue #34 - Q2)**
- [ ] Create `FeaturedLoadBid` table
  - bid_id, booking_id, duration_days, fee_amount, expiry_date, status
- [ ] Implement featured load UI in driver app
  - Special "Featured" section at top
  - Highlighted with gold badge
  - VIP loads show company name prominently
- [ ] Create booking owner portal: `/customer/bookings/featured-boost`
  - Options: 24hrs featured (KES 2,000), 48hrs premium (KES 5,000), 7-day VIP (KES 10,000)
  - One-click purchase via M-Pesa
  - Real-time notification: "Your load is now featured!"
  - Analytics: impressions, bids, CTR by feature tier
- [ ] Bid fee system (secondary monetization)
  - Option: Charge transporter KES 100 per bid placement (instead of free bids)
  - Or: Premium feature—included in featured package

**AD MARKETPLACE (Revenue #12 - Q3)**
- [ ] Create `AdPlacement` table
  - placement_id, position (BANNER_TOP, BANNER_BOTTOM, SIDEBAR, IN_FEED), campaign_id, advertiser_id, cpc (cost per click), budget, impressions, clicks
- [ ] Create `AdCampaign` table
  - campaign_id, advertiser_id, name, budget, start_date, end_date, status
- [ ] Design ad slots in apps
  - Driver app: Banner below active bookings, in load list between offers
  - Customer app: Banner in tracking page, in booking history
  - Fleet dashboard: Widget sidebar
- [ ] Pricing model (suggested)
  - Impression-based: KES 50K for 100K impressions (KES 50 CPM)
  - Click-based: KES 100-500 per click depending on category
  - Categories: Fuel companies, tyre shops, insurance, banks, warehouses
- [ ] Create `/admin/advertising` portal
  - Ad campaign management (create, pause, stop)
  - Analytics: impressions, clicks, CTR, spend
  - Billing: monthly invoice generation
- [ ] Create advertiser self-service portal: `/advertiser/campaigns`
  - Simple ad creation (image, link, target audience)
  - Budget setting and monitoring
  - Performance dashboard

**FUEL PARTNER SYSTEM (Revenue #6 - Q3)**
- [ ] Create `FuelPartner` table
  - partner_id, petrol_station_name, location, manager_contact, discount_rate (%), commission_rate (%), status
- [ ] Create `FuelDiscount` table
  - discount_id, partner_id, discount_code, valid_from, valid_to, discount_percent
- [ ] Partner onboarding flow: `/admin/marketplace/fuel-partners`
  - Registration form (station details, contact, commission rate)
  - Admin review/approval workflow
  - Contract generation PDF
- [ ] Driver discount experience
  - Driver sees list of nearby petrol stations (geo-filtered)
  - QR code display for each station (time-limited, single-use)
  - Real-time discount % shown (e.g., "25% off at Shell Mombasa Rd")
  - Scan at pump or show to attendant
- [ ] Transaction recording
  - Fuel log entry: `FuelLog` table with `partnerId`, `discountApplied`, `commission`
  - Track volume per station and driver tier
- [ ] Commission settlement
  - Monthly report: Station X drove Y liters, saved Z KES, owes commission M
  - Auto-invoice generation
- [ ] Partner dashboard: `/partner/fuel-dashboard`
  - Drivers using your discount this month
  - Total commission earned
  - Discount performance (most used discount, most active drivers)
  - Settlement history

**IMPORT/EXPORT CLEARING REFERRAL (Revenue #5 - Q3)**
- [ ] Create `ClearingAgent` table
  - agent_id, agent_name, company, contact, service_types (documentation, clearance, handling), commission_rate (%), status
- [ ] Create `ClearingRequest` table
  - request_id, booking_id, agent_id, service_type, goods_value, clearing_cost, zito_referral_fee, status
- [ ] Clearing agent onboarding: `/admin/marketplace/clearing-agents`
  - Application form (company reg, experience, services offered)
  - Admin review/approval
  - Commission rate agreement
- [ ] Customer flow during cross-border booking
  - Booking crosses border (Kenya → Uganda)
  - System suggests "Need customs clearance?" option
  - Shows available clearing agents
  - One-click request
  - Agent responds with quote
  - Customer accepts or declines
- [ ] Commission tracking
  - On agent service completion, record commission in `ClearingRequest.zitoReferralFee`
  - Auto-invoice agent for ZITO commission amount
  - Settlement: Monthly, net-30

**AGENT FRANCHISE MODEL (Revenue #23 - Q3)**
- [ ] Create `Franchise` table
  - franchise_id, agent_id, region, franchise_fee_paid, start_date, commission_split (%), tier (BRONZE/SILVER/GOLD), status
- [ ] Franchise onboarding: `/admin/partnerships/franchises`
  - Application form (agent details, region, commitment)
  - Agreement template + signature capture
  - Franchise fee payment (KES 500K-2M) via M-Pesa
  - Region exclusivity setup
- [ ] Revenue split configuration
  - BRONZE: ZITO 30%, Franchisee 70%
  - SILVER: ZITO 25%, Franchisee 75%
  - GOLD: ZITO 20%, Franchisee 80%
- [ ] Franchisee dashboard: `/franchise/dashboard`
  - Region bookings & revenue
  - Commission earned this month
  - Growth metrics (vs target)
  - Settlement history
- [ ] Performance tracking
  - Monthly KPI check-in: Min bookings, compliance score
  - Performance tiers: Below target → warning → probation → termination

---

### 4. LOYALTY & REWARDS MODULE
**Current Status:** Partially exists (Phase 3)  
**Enhancements Needed:** None immediate, but track for monetization

#### Sprint Tasks:

**CONFIRM LOYALTY SYSTEM MONETIZED**
- [ ] Verify referral system works end-to-end
  - Generate code → Share → Signup → First booking → KES 500 credit to both
  - Test M2M flow (driver referral) vs B2C (customer referral)
- [ ] Verify loyalty points system works
  - 10% points on booking value
  - Tier progression (Bronze → Silver → Gold → Platinum)
  - Points redeemable (1 point = 0.5 KES discount)
- [ ] Track cost of loyalty program in financial reporting
  - Discount cost = points redeemed × 0.5 KES
  - Referral cost = active referrals × KES 500
  - ROI = repeat booking rate increase

---

### 5. WAREHOUSE & LOGISTICS MODULE
**Current Status:** Warehouse system exists (Phase 2)  
**Enhancements Needed:** Cross-border, clearing partnerships, parts marketplace

#### Sprint Tasks:

**CROSS-BORDER LOGISTICS (Revenue #22 - Q3)**
- [ ] Enhance multi-country support (already exists, enhance)
  - Booking route detection: If pickup_country != delivery_country, flag as cross-border
  - Multi-country rate cards (already exists)
  - Currency conversion (already exists)
- [ ] Create `CrossBorderFee` table
  - border_route_id, from_country, to_country, customs_fee, border_crossing_fee, permit_fee, agency_coordination_fee
- [ ] Customs documentation workflow
  - Templates for HS codes, manifests, permits by country
  - Auto-populate from booking details (goods description, value, weight)
  - PDF generation and filing
- [ ] Create `BorderCrossingRecord` table
  - record_id, booking_id, customs_docs, permit_id, crossing_date, crossing_notes
- [ ] Agency network expansion
  - Create `BorderAgency` table (agency_id, country, region, contact)
  - Agency assignment (nearest agency for route)
  - Agency handoff trigger (booking reaches border checkpoint)
- [ ] Fee calculation on cross-border booking
  - Base commission (8%)
  - Customs documentation fee: KES 2,000
  - Border processing fee: KES 1,500
  - Agency coordination fee: KES 1,000
  - Permit handling fee: KES 500
  - Total additional revenue: ~KES 5,000-6,000 per cross-border shipment
- [ ] Create `/admin/borders` dashboard
  - Cross-border routes and volumes
  - Partner agency performance
  - Permit status tracking
  - Revenue by border crossing

**SPARE PARTS MARKETPLACE (Revenue #8 - Q4)**
- [ ] Create new marketplace sub-module: `parts-marketplace`
- [ ] Create `Part` table
  - part_id, vendor_id, category (TYRES, BRAKE_PADS, BATTERIES, OILS, ENGINE_PARTS), name, description, price, inventory
- [ ] Create `PartVendor` table
  - vendor_id, company_name, contact, listing_fee_status, commission_rate (%), inventory_auto_sync
- [ ] Vendor onboarding: `/admin/parts/vendors`
  - Registration form
  - Inventory upload (CSV/API)
  - Commission agreement (listing fee: KES 5,000/month, commission: 10%)
  - Product approval workflow (admin reviews quality)
- [ ] Customer experience: `/customer/parts`
  - Search by vehicle type (truck model, engine type)
  - Browse categories
  - Add to cart → checkout
  - Delivery via ZITO fleet (premium positioning!)
- [ ] Revenue streams
  - Listing fees: KES 5,000/month per vendor
  - Commission: 10% on sales
  - Featured part promotion: KES 2,000/week per part
- [ ] Integration with vehicle profiles
  - Show recommended parts based on vehicle type
  - Maintenance alerts (predictive) recommend parts

---

### 6. ANALYTICS & REPORTING MODULE
**Current Status:** Analytics dashboard exists (Phase 4)  
**Enhancements Needed:** Revenue reporting, subscription analytics, new KPIs

#### Sprint Tasks:

**REVENUE DASHBOARD ENHANCEMENTS**
- [ ] Create `/admin/revenue` dashboard showing
  - Revenue by source (booking commission, SaaS subscriptions, marketplace, fintech, etc.)
  - Monthly trend (MoM growth)
  - Recurring revenue (MRR) vs one-time revenue
  - Customer LTV by segment
- [ ] Add KPI cards
  - Total MRR (monthly recurring)
  - New subscriptions this month
  - Churn rate (% subscriptions cancelled)
  - Gross margin %
  - Revenue per booking
- [ ] Implement revenue forecasting
  - Historical trend analysis
  - Conservative, expected, optimistic scenarios
  - 12-month projection

**SUBSCRIPTION ANALYTICS**
- [ ] Create `/admin/subscriptions` dashboard
  - Active subscriptions by product type and tier
  - Subscription growth trend
  - Churn analysis (why are customers cancelling?)
  - Upgrade/downgrade funnel
  - Cohort analysis (compare cohorts by signup month)
- [ ] Alerts for anomalies
  - Alert if monthly churn > 5%
  - Alert if monthly new subscriptions < expected
  - Alert if failed payment rate > 3%

**MARKETPLACE PERFORMANCE**
- [ ] Track each revenue stream separately
  - Featured listings: Count, revenue, ROI (revenue vs cost of feature)
  - Fuel partnerships: Transactions, commission earned, top stations
  - Clearing referrals: Referrals made, commissions earned
  - Ads: Impressions, clicks, CTR, revenue

---

### 7. ROUTE OPTIMIZATION MODULE
**Current Status:** Route optimization exists (Phase 4)  
**Enhancements Needed:** Feature gating for premium, ML model for pricing

#### Sprint Tasks:

**ROUTE OPTIMIZATION PREMIUM (Revenue #16 - Q3)**
- [ ] Feature gate advanced optimization
  - Free: Basic shortest-path calculation
  - Premium: Multi-stop optimization, traffic prediction, fuel prediction
- [ ] Access control in route-optimization service
  - Check user subscription tier before processing premium request
  - Return "upgrade required" error if tier insufficient
- [ ] Premium features
  - Multi-warehouse optimization (50+ stops) - Premium only
  - Fuel prediction (cost savings estimates) - Premium only
  - Traffic prediction (historical + real-time) - Premium only
  - Driver behavior analytics - Premium only
  - Route efficiency scoring - Premium only
- [ ] Subscription tier mapping
  - Free: Cannot access
  - Silver: Not available
  - Gold: Full access
  - Platinum: Full access + priority processing
- [ ] Transporter pricing
  - KES 5,000/month (Silver) - basic
  - KES 10,000/month (Gold) - advanced
  - KES 15,000/month (Platinum) - premium + white-label
- [ ] Create `/transporter/route-optimization/premium` UX
  - Show "upgrade to see recommendations"
  - Compare fuel savings estimate vs subscription cost
  - One-click subscribe button

**AI PRICING ENGINE ENHANCEMENT (Revenue #17 - Q2-Q3)**
- [ ] Build historical data pipeline
  - Aggregate past 6 months of bookings
  - Features: route, vehicle_type, time_of_day, day_of_week, demand, supply, price, completion_rate
  - Store in separate analytics warehouse (if not already)
- [ ] ML model training
  - Supervised learning: Predict optimal price for given route/time
  - Demand-supply ratio (current in surge-pricing module)
  - Add: Weather, holidays, competitor activity (if available)
  - Retrain weekly with new data
- [ ] Pricing recommendation engine
  - For each transporter: "Recommended price for this route at this time: X"
  - Show expected demand, supply, recommended adjustment
- [ ] Dashboard: `/transporter/pricing-recommendations`
  - Machine learning insights
  - Recommended prices vs what transporter set
  - Acceptance rate by price tier
  - A/B test results (if transporter allows)
- [ ] Auto-pricing (optional)
  - Allow transporter to auto-apply recommendations
  - Manual override always available

---

### 8. FUEL & FLEET MODULE
**Current Status:** Fuel tracking exists (Phase 2)  
**Enhancements Needed:** Predictive maintenance, partner integration

#### Sprint Tasks:

**PREDICTIVE MAINTENANCE ALERTS (Revenue #18 - Q3)**
- [ ] Build vehicle maintenance database
  - Vehicle make/model, age, mileage history
  - Service history (last oil change, brake service, etc.)
  - Industry standard service intervals
- [ ] ML model for breakdown prediction
  - Training data: Historical maintenance + breakdowns + mileage
  - Features: Mileage, age, service history, trip patterns
  - Predict: Likelihood of breakdown in next 500/1000/1500 km
- [ ] Alert system
  - Threshold: If predicted breakdown probability > 30%, send alert
  - Content: "Oil change recommended (500km left), Schedule now"
  - Link to service booking (Section 55.4.5)
- [ ] Subscription pricing
  - KES 3,000/month per vehicle
  - Fleet discounts: 20% off for 10+ vehicles
- [ ] Dashboard: `/transporter/maintenance-analytics`
  - Next maintenance due by vehicle
  - Breakdown risk scoring
  - Service booking integration
  - Cost savings from preventive maintenance (projected)
- [ ] Fuel partner integration
  - Show fuel discounts during maintenance booking (upsell)

---

### 9. DRIVERS MODULE (Apps)
**Current Status:** Driver app exists  
**Enhancements Needed:** Subscription tier UI, fast payout, loan origination

#### Sprint Tasks:

**DRIVER TIER SUBSCRIPTION UI (Revenue #2 - Q2)**
- [ ] Add subscription section to driver profile
  - Show current tier with badge
  - Benefits comparison table (Free vs Silver vs Gold vs Platinum)
  - "Upgrade" or "Cancel" button
  - Subscription renewal date
- [ ] Upgrade/downgrade flow
  - Show benefits gained/lost
  - Pro-ration calculation if mid-month
  - One-tap subscribe via wallet balance or M-Pesa
  - Confirmation: "You've subscribed to Gold tier! Premium loads now available."
- [ ] Load visibility based on tier
  - Free driver: See standard loads, limited load list (10/day)
  - Silver driver: See more loads (50/day), load history
  - Gold driver: See premium corporate loads, unlimited, analytics
  - Platinum driver: Exclusive loads first, VIP support
- [ ] Rating badge update
  - Show tier as badge on driver profile (visible to shippers)
  - Affects booking acceptance rate (premium shippers prefer higher tiers)

**FAST PAYOUT / ADVANCE PAYOUT (Revenue #15 - Q3)**
- [ ] New tab: "Quick Cash" in driver wallet
  - "Get KES 3,000 instantly (2% fee = KES 60 charge)"
  - Show current available payout balance
  - Fee breakdown clearly shown
  - One-tap payout request
  - Confirmation: "Request submitted, funds arrive in 5 minutes"
- [ ] Integration with fintech partner
  - Call partner API: `instantPayout(driverId, amount, fee)`
  - Immediate funds transfer to driver's phone/bank
  - ZITO collects fee from driver's wallet
- [ ] History tracking
  - Show all instant payout requests
  - Date, amount, fee, status
  - Repayment schedule (if loan-based)

**DRIVER WALLET MICROFINANCE (Revenue #24 - Q4)**
- [ ] New section: "Get Ahead" (loans/advances)
  - Trip Advance: "Borrow KES 10K, repay from next 3 bookings"
  - Fuel Advance: "Get KES 5K fuel credit, repay from earnings"
  - Emergency Loan: "Borrow KES 50K @ 15% APR"
- [ ] Loan application flow
  - Pre-qualification: Show max borrowing amount based on credit score
  - Simple form: Loan amount, purpose (dropdown), term
  - Instant or 24-hour approval
  - Funds to wallet if approved
- [ ] Credit score display
  - Show driver's credit score (simplified: 1-100)
  - Show components affecting score (on-time %, rating, account age)
  - "Improve score by: completing bookings on-time, maintaining 4.5+ rating"
- [ ] Repayment tracking
  - Active loans dashboard
  - Next repayment due date
  - Repayment history
  - Early repayment option (slight fee waived)
- [ ] Auto-repayment
  - System auto-deducts repayment from trip earnings on payout day
  - Reminder SMS if payment due

---

### 10. CUSTOMERS MODULE (Apps)
**Current Status:** Customer app exists  
**Enhancements Needed:** Booking verification fees, escrow transparency

#### Sprint Tasks:

**VERIFICATION FEE PURCHASE**
- [ ] During booking flow, if shipper is new/unverified:
  - "Your account is unverified. Complete verification to unlock better rates."
  - Options: Skip (standard rate) or Verify Now (pay KES 2,000, get 10% rate discount)
- [ ] Verification options in customer profile
  - Identity verification (KES 500, 2-hour turnaround)
  - Company verification (KES 2,000, 24-hour turnaround)
  - Trust badge (KES 2,000/month recurring)
- [ ] Payment flow
  - Click verification option
  - Show fee and benefit
  - Pay via M-Pesa wallet
  - Verification starts immediately (or scheduled)
  - Notification when complete

**ESCROW TRANSPARENCY (Revenue #14 - Enhancement)**
- [ ] Booking preview shows fee breakdown
  ```
  Distance: 50 km
  Base Rate: KES 10,000
  ZITO Commission: KES 800 (8%)
  Escrow Service Fee: KES 300 (3%) ← NEW LINE
  You Pay Total: KES 11,100
  Driver Receives (after fees): KES 9,900
  ```
- [ ] Tracking page shows escrow status
  - "Funds held in escrow until delivery confirmed"
  - Release date: After driver confirms delivery + you approve
  - Dispute button (if needed)
- [ ] Receipt shows full accounting
  - Total charged
  - Commission & escrow fee breakdown
  - Driver payout amount
  - Settlement date

---

### 11. ADMIN & OPERATIONS MODULE
**Current Status:** Admin portal exists (Phase 4)  
**Enhancements Needed:** All new revenue stream management pages

#### Sprint Tasks:

**RECURRING BILLING MANAGEMENT**
- [ ] `/admin/subscriptions` page
  - List all active subscriptions (driver tiers, fleet SaaS, etc.)
  - Filter by product type, tier, status
  - Search by customer ID
  - Manual actions: Cancel, upgrade, refund
  - KPIs: Active subs, MoM growth, churn rate
- [ ] `/admin/subscription-failures`
  - Failed payment attempts
  - Driver: Ability to retry payment
  - Reason analysis (insufficient funds, account closed, etc.)
  - Automatic retry schedule

**VERIFICATION MANAGEMENT**
- [ ] `/admin/verification-requests`
  - List pending verifications
  - Review submitted docs
  - Approve/reject with comment
  - Charge fee on approval
  - Generate certificate

**MARKETPLACE MANAGEMENT (Enhancements)**
- [ ] `/admin/marketplace/fuel-partners`
  - Onboard petrol station partners
  - Approve/reject applications
  - Commission settlement tracking
  - Performance metrics per partner
- [ ] `/admin/marketplace/clearing-agents`
  - Clearing agent network
  - Onboarding approvals
  - Commission tracking
  - Performance ratings
- [ ] `/admin/marketplace/franchises`
  - Franchise applications
  - Agreement signing
  - Fee collection tracking
  - Performance monitoring (KPIs vs targets)
- [ ] `/admin/advertising`
  - Advertiser onboarding
  - Campaign management
  - Analytics (impressions, clicks, ROI)
  - Billing

**ROUTE OPTIMIZATION PREMIUM**
- [ ] `/admin/route-optimization/subscriptions`
  - Active premium subscribers (transporter tier)
  - Feature usage analytics
  - Performance impact (fuel savings reported)
- [ ] `/admin/route-optimization/ml-model`
  - Model performance metrics
  - Last training date
  - Accuracy on validation set
  - Manual retraining trigger

**FINTECH PARTNER MANAGEMENT**
- [ ] `/admin/fintech/payout-logs`
  - Fast payout transaction history
  - Amount, fee, timestamp, recipient
  - Failed payout retry interface
- [ ] `/admin/fintech/loans`
  - Active driver loans
  - Default monitoring
  - Collections status
  - Partner settlement

---

### 12. BACKEND INFRASTRUCTURE CHANGES

**REQUIRED: Shared Subscription Billing Framework**
- Create `RecurringBillingService` (dependency for multiple features)
- Implement monthly cron job (`processMonthlyBillings`)
- Handle payment failures and retry logic
- M-Pesa integration for recurring charges

**REQUIRED: ML/Data Pipeline**
- Build data aggregation for ML models (pricing, maintenance)
- Data warehouse for analytics
- Scheduled retraining pipelines
- Model versioning and rollback capability

**REQUIRED: Fintech Partner Integration Layer**
- Design adapter pattern for multiple fintech providers
- Implement first provider (Equity Bank Fuliza or Lendable)
- Handle webhook callbacks from partner APIs
- Reconciliation and settlement mechanics

**OPTIONAL: Ad Network Infrastructure**
- Ad serving service
- Impression/click tracking
- Billing integration
- Performance analytics

---

## Implementation Timeline Summary

### Q1 2026 (Jan-Mar)
- SMS/WhatsApp metering ✅
- Verification fees ✅
- Recurring billing framework (foundation) ✅

### Q2 2026 (Apr-Jun)
- Driver subscription tiers 🚀
- Pickup & Drop subscriptions 🚀
- Featured premium loads 🚀
- AI Pricing Engine enhancement 🚀
- Escrow transaction fees (UI) 🚀

### Q3 2026 (Jul-Sep)
- Fuel partner system 🚀
- Cross-border logistics fees 🚀
- Agent franchise program 🚀
- Fast payment/advance payout 🚀
- Route optimization premium 🚀
- Predictive maintenance alerts 🚀
- Import/Export clearing 🚀
- API monetization 🚀
- Ad marketplace 🚀

### Q4 2026 (Oct-Dec)
- Insurance marketplace 🚀
- Spare parts marketplace 🚀
- Vehicle service booking 🚀
- Driver wallet microfinance 🚀
- Invoice financing 🚀
- Training & certification 🚀

---

## Dependencies & Blockers

### Critical Path Items (Block other features if delayed):
1. **Recurring Billing Framework** (Q1) → blocks drivers, pickup-drop, fleet SaaS subscriptions
2. **Fintech Partner Selection & Integration** (Q2 planning) → blocks fast payout, microfinance, invoice financing
3. **ML Data Pipeline** (Q2) → enables pricing engine, maintenance alerts, credit scoring

### Optional But Recommended:
- Partner recruitment should start in Q1 (fuel stations, mechanics, insurance companies)
- Legal review for cross-border compliance (Q2)
- Franchise agreement templating (Q2)

---

## Success Criteria

- [ ] All 9 existing revenue streams properly metered and reported
- [ ] Recurring billing framework tested and live
- [ ] First fintech partner integrated (fast payout or microfinance)
- [ ] MRR tracking dashboard live
- [ ] Q2 revenue streams (driver tiers, pickup-drop) delivering revenue by June 30
- [ ] Partner network expansion (5+ fuel partners, 10+ clearing agents, 3+ mechanics networks onboarded by Q3)
- [ ] Year-end ARR projection: KES 3-5B (from all 30 streams, conservative estimates)

---

**Document Status:** Ready for Sprint Planning  
**Last Updated:** May 28, 2026  
**Next Review:** June 1, 2026 (Sprint planning meeting)
