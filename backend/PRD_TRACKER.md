# ZITO PRD Tracker

## Active Source
`docs/prd/ZITO_PRD_v10_ULTIMATE.txt` is the master searchable text export of the PRD.
`docs/prd/ZITO_PRD_v10_ULTIMATE.docx` is the official source document in Microsoft Word format.
Brand identity: `Aurenza Limited` (company) + `Zito` (product/app)
Last Major Update: May 28, 2026 (Phase 1 Money Machine Revenue Streams Implementation)
Last Sync: May 28, 2026

## Documentation Organization (May 28 - CLEANUP)
All documentation is now stored in `docs/prd/` folder ONLY:
- `ZITO_PRD_v10_ULTIMATE.txt` - Master searchable PRD (updated May 28)
- `ZITO_PRD_v10_ULTIMATE.docx` - Official PRD Word document
- All other documentation in `/docs/prd/` subfolder only
- No scattered docs in workspace root (cleanup completed May 28)

## Phase 1 Status
- Core Platform scope is implemented across the backend and the Next.js web portal.
- Verification completed with `backend/npm run build`, `frontend/npx tsc --noEmit`, and `frontend/npm run build`.

### Phase 1 Money Machine: Revenue Streams (May 28, 2026)
**NEW** — Three core revenue streams now implemented in backend with wallet integration, recurring billing, and SMS notifications:

1. **Driver Subscriptions** (backend/src/modules/subscriptions/)
   - Four tiers: FREE, SILVER (KES 2K/mo), GOLD (KES 5K/mo), PLATINUM (KES 10K/mo)
   - Feature access control: load visibility limits (10, 50, unlimited), corporate_loads, priority_dispatch access
   - Recurring monthly billing via Cron job (processMonthlyBilling runs daily, charges due subscriptions)
   - Payment retry logic: 3 attempts with 2-day grace period, auto-suspend on failure
   - Resume capability: Driver can retry failed payment to reactivate
   - Endpoints: GET /tiers, POST /create, GET /current, PATCH /update, DELETE /cancel, POST /:id/resume, POST /:id/charge
   - SMS notifications: upgrade, billing_reminder, payment_failed, suspended, resumed
   - Integration: PaymentsService (wallet deduction/refund), NotificationsService (SMS templates)
   - Backend Status: ✅ 100% COMPLETE (service, controller, DTOs, Prisma models, Cron jobs)
   - Frontend Status: 🔲 0% (subscription tier UI pending Week 2)

2. **Featured Listings** (backend/src/modules/marketplace/featured-listings.service.ts)
   - Three tiers: FEATURED (KES 500/day, 1-3 days), PREMIUM (KES 1K/day, 4-7 days), VIP (KES 5K/month)
   - Marketplace visibility premium: top ranking by tier for load searches
   - Full lifecycle: purchase → extend → cancel with 24-hour refund window (100% if within 24h)
   - Auto-expiry: Cron job daily marks expired listings, removes badges from bookings
   - Search ranking: VIP > PREMIUM > FEATURED in active listings
   - Endpoints: GET /pricing, POST /purchase, GET /:id, GET /active (list), POST /:id/extend, DELETE /:id/cancel
   - SMS notifications: purchase, extension, cancellation, expiry_approaching
   - Integration: PaymentsService (wallet deduction/refund), Booking model (isFeatured, featuredTier fields)
   - Backend Status: ✅ 100% COMPLETE (service, DTOs, Prisma models, Cron jobs)
   - Frontend Status: 🔲 0% (featured listing purchase modal pending Week 2)

3. **Verification Expedite Fees** (backend/src/modules/audit/verification-fee.service.ts)
   - Standard verification: FREE, 7-10 day processing
   - Expedited verification: KES 500, 24-hour priority processing with digital certificate
   - Certificate issuance: 1-year validity, certificate number for verification checks
   - Rejection refund: Full KES 500 refund to wallet if admin rejects
   - Endpoints: GET /pricing, GET /status, POST /expedite, POST /approve (admin), POST /reject (admin)
   - SMS notifications: paid, approved, rejected, refunded
   - Integration: PaymentsService (wallet charge/refund), User model (verificationFees[], certificates[] relations)
   - Backend Status: ✅ 100% COMPLETE (service, DTOs, Prisma models, approval workflow)
   - Frontend Status: 🔲 0% (expedite button on KYC screen pending Week 2)

**Database Schema Updates (Prisma)**
- New Enums: SubscriptionTier, SubscriptionStatus, SubscriptionChargeStatus, FeaturedListingStatus, FeaturedListingTier
- New Models: Subscription, SubscriptionCharge, FeaturedListing, VerificationFeePayment, VerificationCertificate
- Modified Models: User (subscription relation, verification relations), Booking (isFeatured, featuredTier)
- Pending Migration: `npx prisma migrate dev --name phase1_revenue_streams_and_operations`

**Revenue Projections (Phase 1 Month 1-6)**
- Subscriptions: KES 22.5M/month (by Month 6, assuming 5K drivers on average tier)
- Featured Listings: KES 4.5M/month (by Month 6, assuming 20% of shipments featured)
- Verification Expedite: KES 1.25M/month (by Month 6, assuming 10% of new users expedite)
- **Total Phase 1 Revenue: KES 28.25M/month by end of June**

- Remaining workstreams in this tracker should be treated as Phase 2+ expansion, not Phase 1 blockers.

## Phase 2 Status
- Warehouse and inventory Phase 2 scope is implemented and build-verified.
- Warehouse APIs cover scoped access, detail and update endpoints, and zone or bin occupancy reporting.
- Inventory APIs expose item list and detail flows and persist movement history for state changes.
- Scan APIs enforce checkpoint validation plus vehicle load or unload and delivery-confirmation capture.
- Waybill APIs support booking-linked parcel manifests, LR vs Waybill type routing, audit locking, and PDF manifest generation.
- Loss-detection APIs support mismatch checks, stale-item alerts, report listing, and high-value approval flow handling.
- RTO APIs support initiation, lifecycle transitions, warehouse receipt, and record listing or detail.
- Fuel APIs support trip fuel logs, variance analysis, flagged-usage alerts, and admin or transporter reporting endpoints.
- Phase 2 frontend coverage exists for warehouse dashboard, bins, inventory, scan, loss-detection, and fuel reporting, which matches the explicit frontend scope in `backend/prd_plan_clean.txt`.

## Phase 3 Status
- Rate-card coverage from PRD section 19 is active across the backend and admin web portal.
- Backend rate-card APIs support admin CRUD, active-card calculation, and version-preserving updates through new records plus audit logging.
- Frontend admin coverage includes `/admin/rate-cards` with historical visibility and a pricing calculator.
- Invoice and billing coverage from PRD sections 16-18 is active across the repo.
- Backend invoice APIs support booking invoice generation, type assignment, audit lock on issue, approval routing, customer, corporate, and admin listing, plus PDF export payloads.
- Backend billing APIs support warehouse billing using storage-unit-day calculation from current schema data plus combined invoice generation for corporate clients.
- Frontend coverage includes `/customer/invoices`, `/corporate/invoices`, and `/admin/invoices`.
- Contract coverage from PRD section 20 is active with corporate contract CRUD, credit exposure sync, booking-limit enforcement, and admin plus corporate portal pages.
- SLA coverage from PRD section 21 and section 44.10 is active with service-type timer configs, delay detection, escalation levels, booking timer inspection, and driver no-show reassign or requeue handling.
- Reconciliation coverage from PRD section 35 and section 44.12 is active with invoice and payment auto-match, mismatch detection, daily reporting, and `/admin/reconciliation`.
- Admin-control coverage from PRD section 44.14 is active with approval requests, dual authorization for refunds and payout overrides, audited booking-cancel requests, `/admin/audit`, and `/admin/staff-performance`.
- Analytics and retention coverage from PRD sections 27A and 27B is active with revenue dashboards, driver KPIs, warehouse utilization, CLV, repeat-rate tracking, a rating-derived NPS proxy, and `/admin/analytics`.
- Promo-code, loyalty-point, and referral metrics are derived from wallet-transaction and audit-log conventions in the current schema, which keeps the Phase 3 analytics slice live without adding new tables.

## Phase 4 Status
- Fraud-detection coverage from PRD section 44.7 is active with GPS spoof detection, ghost-trip detection, duplicate-booking heuristics, route-anomaly detection, fraud-flag review actions, suspension controls, and `/admin/fraud`.
- Surge-pricing coverage from PRD section 44.8 is active with zone demand-supply ratios, configurable peak-hour rules, surge-zone activation and deactivation, Super Admin override, live booking-price application, and the surge tab inside `/admin/rate-cards`.
- Route-optimization coverage from PRD section 44.17 is active with a dedicated backend module, Google Directions API support when configured, fallback shortest-path and multi-stop optimization logic, route-deviation alerts, dynamic recalculation, and the customer route layer inside `/customer/tracking/[bookingId]`.
- Driver-heatmap coverage from PRD section 44.21 is active with demand-vs-driver zone scoring, a driver-focused heatmap endpoint, threshold controls, `/driver/heatmap`, and a reusable heatmap layer component.
- Heatmap threshold persistence is currently configuration-based in service memory because the current Prisma schema has no dedicated settings model for this slice.
- Capacity-planning coverage from PRD section 44.18 is active with warehouse occupancy snapshots, fleet availability tracking, booking-time overbooking prevention, and historical-demand forecasting through the new `capacity-planning` module.
- Warehouse capacity planning uses live bin occupancy as the fullness signal because the current schema has no separate reserved-space model, and fleet planning is global because vehicles do not carry a direct agency foreign key in the schema.
- Internal-alert coverage from PRD section 39 is active with missing-parcel, payment-failure, delay, fraud, low-capacity, and driver-offline triggers, recipient routing, queue resolution, and `/admin/alerts`.
- System-health coverage from PRD section 44.11 is active with runtime API-failure metrics, Prisma slow-query capture, DB and Redis health checks, `/health`, and `/admin/system-health`.
- BullMQ queue monitoring now attaches when `BULLMQ_ENABLED` is enabled and the queue runtime is present, and Sentry or Datadog forwarding now activates when the corresponding environment variables are configured.
- Session and access-control coverage from PRD section 44.15 is active with session-bound JWTs, configurable inactivity expiry, suspicious-login alerts, `/auth/reauth`, and Super Admin forced logout.
- Session state now persists through schema-backed session records, so inactivity expiry and forced logout survive process restarts instead of depending on in-memory runtime state.

## Phase 5 Status
- Offline-mode coverage from PRD section 23 is now active across backend and frontend.
- The warehouse scan flow already had local queueing, and it now includes stable client references, offline occurrence timestamps, duplicate-scan merge handling, stale-event rejection, and retry-safe reconnect sync.
- Map components now cache their latest live-tracking and driver-heatmap snapshots locally, so low-connectivity sessions can fall back to cached route and demand views.
- Frontend API requests now support exponential retry backoff for safe retry paths, and scan sync uses that retry path together with backend deduplication.
- Multi-currency coverage from PRD section 23 is now active with backend currency config, env-overridable conversion rates, supported-currency listing, and rate-card quote conversion for KES, UGX, TZS, RWF, NGN, GHS, and ZAR.
- Multi-language coverage from PRD section 23 is now active with `next-intl` language packs for English, Kiswahili, French, and Amharic plus a customer profile selector backed by schema-stored user preferences.
- Customer and corporate booking confirmation flows now surface preferred-currency quote previews from the live rate-card calculation path before booking creation.
- Marketplace coverage from PRD section 44.20 is now active with a dedicated backend module, transporter and warehouse-partner onboarding, approval or suspension workflow, partner-side opportunity listing, fixed-price acceptance, open-bid and negotiation flows, plus commission tracking on awarded work.
- Admin marketplace coverage is now live at `/admin/marketplace`, where operations can onboard partners, publish booking opportunities, review bid stacks, inspect partner performance, and rerun marketplace monitoring.
- Marketplace partner review and low-performance follow-up now surface through `InternalAlert` records, while partner scorecards derive completion, on-time, bid-conversion, and fraud signals from the current schema-backed implementation.
- Warehouse listing and online booking coverage is now active as an explicit extension of PRD sections 10, 17, and 44.20.
- Warehouse partners can submit customer-facing listings from `/warehouse/listings` with company details, VAT setup, documents, photos, rates, capacity, area, and managed-warehouse linkage.
- Admin and Super Admin can review, approve, reject, request changes, or suspend listings from `/admin/warehouse-listings`.
- Customers can discover approved warehouse listings and book online from `/customer/warehouse`, while warehouse partners manage booking status from `/warehouse/bookings`.
- Warehouse bookings now record customer total, VAT, 10 percent default Zito commission, partner net amount, and status lifecycle for requested, accepted, received, stored, ready-for-pickup, completed, and cancelled states.
- Partner-onboarding coverage from PRD section 50 is now active with driver referral registration and conversion, joining-bonus wallet credits, transporter bulk fleet onboarding, and onboarding-funnel analytics for registered-to-verified-to-active supply tracking.
- Multi-country expansion coverage from PRD section 49 is now active with country pricing and tax overlays for Kenya, Uganda, Tanzania, and Rwanda, cross-border agency handoff records backed by parcel-scan confirmation, and inter-agency settlement generation.
- USSD fallback coverage from PRD section 23 is now active through `/ussd`, with a session-backed book-track-pay menu flow plus SMS confirmations after USSD booking or payment initiation.

## Expansion Addendum Status
- The repo PRD now includes `58. Courier Company & Owned Fleet Expansion Addendum`, synced from the external master and appended to the repo copy on 29 April 2026.
- Schema addendum coverage is active with the `COURIER_COMPANY` role plus vehicle ownership linkage between `User` and `Vehicle`.
- Fleet APIs now enforce owner-account scope for customer, corporate, courier-company, and transporter roles, which enables self-managed fleet operations without exposing other accounts' vehicles.
- Booking validation now supports courier-company multi-load and multi-unload flow by requiring at least one pickup or load stop and at least one delivery or unload stop, while the booking model now stores whether execution is `OWNED_FLEET`, `CFA_NETWORK`, or `BLENDED`.
- Web coverage is active for `/customer/fleet`, `/corporate/fleet`, and the separate `/courier-company/*` portal, including multi-stop movement-plan composition, dispatch visibility, scan operations, waybill access, and owned-fleet management.
- Platform-fee charging per vehicle or fleet is now active through `/admin/billing/platform-fee`, with role-aware default fee rules, idempotent billing-window protection, platform invoice generation, and self-serve invoice visibility for courier-company and transporter accounts.
- Mobile courier-company and customer-owned-fleet coverage is now active through the Expo app routes, including customer-owned-fleet management and a dedicated courier-company tab workspace.
- Fleet and driver verification evidence is live-camera-only: vehicle views, compliance documents, and driver identity photos must be captured in-app; gallery uploads, imported PDFs, and manual photo URLs are not valid verification evidence.

## Legacy Cleanup
Legacy PRD files and PRD-linked testing documentation under `docs/prd/` and `docs/testing/` have been removed from the repo.
Stale top-level repo references to older PRD versions have been updated to point at the current baseline.

## New PRD Scope
- Identity and access: user roles, authentication, signup or KYC, staff login, advanced RBAC, and security.
- Core logistics: booking engine, driver matching, driver operations, fleet and vehicle, warehouse, inventory, barcode or scan, loss detection, LR or waybill, and real-time tracking.
- Finance and commercial control: payments and wallets, invoices, warehouse billing, multi-service billing, rate cards, contracts, accounting, and revenue model.
- Operations and support: admin operations, incidents, analytics, customer retention, agency management, staff management, customer support, customer care, internal alerts, internal audit, and multi-agency flow.
- Platform readiness: offline behavior, notifications, architecture, backup and disaster recovery, API design, core data models, infrastructure and scaling, go-to-market, and partner onboarding.

## Repo Areas Already Carrying This PRD Forward
- Backend APIs: auth, OTP, users, bookings, contracts, payments, agencies, staff, transport, warehouse, inventory, scan, waybill, loss-detection, RTO, SLA, and reconciliation.
- Frontend portals: role-based admin, customer, corporate, courier-company, driver, staff, transporter, and warehouse views covering the delivered Phase 1 to Phase 5 slices plus the active addendum.
- Mobile flows: auth, customer booking or tracking, customer-owned fleet, courier-company dashboard or fleet workflows, driver trips or earnings, and transporter dashboard or fleet workflows remain part of the wider PRD footprint.

## Follow-up Audit Hotspots
- The phased implementation area from PRD v10 is complete through Phase 5, so remaining follow-up is operational rather than a missing repo phase slice.
- Multi-region Neon-backed rollout is still environment-driven and not provisioned inside this repo, even though the country-config and inter-agency code paths are now in place.
- Payments now support direct `invoiceId` linkage, and reconciliation prefers invoice-linked matching first while preserving booking and invoice-number fallback for historical records.
- Promo-code, loyalty-point, and referral execution still rely on wallet-transaction and audit-log conventions rather than dedicated program tables, so future commercial expansion may still justify a dedicated ledger model.
- Keep executable engineering tests for safety, but do not use old PRD versions as the functional source of truth anymore.
