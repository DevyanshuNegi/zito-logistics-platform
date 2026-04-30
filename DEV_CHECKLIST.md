# ZITO DEV CHECKLIST

This file tracks development against the PRD v10 source set:

- `docs/prd/ZITO_PRD_v10_ULTIMATE.docx`
- `docs/prd/ZITO_PRD_v10_ULTIMATE.txt`
- `docs/prd/ZITO_Phased_Implementation_Plan.docx`
- `backend/prd_plan_clean.txt`
- Brand identity: `Aurenza Limited` is the company name and `Zito` is the product/app name.
- The repo PRD source was re-synced on 29 April 2026 from the external master v10 copy, which restored missing readiness, release-gate, non-functional, fallback, testing, and go-live sections.

> Delivery Board: Phase 1 DONE | Phase 2 DONE | Phase 3 DONE | Phase 4 DONE | Phase 5 DONE | Expansion Addendum ACTIVE
> Current Focus: PRD v10 phased implementation scope is complete through Phase 5. The active repo addendum now covers courier-company operations, owned-fleet management, and PTL multi-load/unload workflows.
> Last Updated: 29 April 2026

## How To Read This Checklist
- `[x]` means the slice is implemented in the repo and verified against the current build.
- `[ ]` means the slice is still pending, or only partially covered and not ready to mark complete.
- The `Delivery Board` line above is the quickest way to see what is done vs what is still open.

---

## Phase 1: Core Platform (Weeks 1-6)
Goal: Customers can register, book a trip, pay, and track it. Drivers receive jobs and update status. Admins manage everything.

### 1.1 Authentication and Users
- [x] Backend: Auth module (login, JWT, refresh token)
- [x] Backend: OTP flow with rate limit, cooldown, and account lock
- [x] Backend: User registration and KYC upload support
- [x] Backend: Account lifecycle (PENDING -> VERIFIED -> ACTIVE)
- [x] Backend: JWT guard, roles guard, and RBAC decorators
- [x] Frontend: Login page, register page, OTP verify page, pending approval page
- [x] Frontend: Role selection screen

### 1.2 Agency Setup
- [x] Backend: Agency CRUD (create, update, list, deactivate)
- [x] Backend: Agency controller with RBAC
- [x] Backend: Staff controller and service coverage
- [x] Frontend: Admin agency dashboard

### 1.3 Booking Engine
- [x] Backend: Create booking with multi-stop support and pricing
- [x] Backend: 15-state lifecycle with audit trail
- [x] Backend: Cancellation with reason and penalty logic
- [x] Backend: Idempotency protection on booking create
- [x] Backend: Admin booking list, assign driver, override status, cancel
- [x] Backend: Driver trip list, status update, reject
- [x] Backend: Customer booking list, detail, cancel, rate
- [x] Backend: Delivery OTP generated on assignment and enforced on delivery
- [x] Frontend: Customer booking list, detail, and cancel
- [x] Frontend: Customer new booking wizard (3-step)
- [x] Frontend: Admin bookings dashboard with filters

### 1.4 Driver System
- [x] Backend: Driver profile, GPS update, online/offline toggle
- [x] Backend: Driver matching engine
- [x] Backend: Shift system (start/end, max hours, fatigue, rest)
- [x] Backend: ShiftActiveGuard
- [x] Backend: Payroll engine
- [x] Frontend: Driver dashboard and jobs workspace
- [x] Frontend: Shift control screen
- [x] Frontend: Earnings screen

### 1.5 Fleet and Vehicle
- [x] Backend: Vehicle CRUD (add, edit, assign to driver, retire)
- [x] Backend: Insurance and permit expiry tracking with auto-suspend
- [x] Backend: Dual GPS tracking and divergence checks
- [x] Backend: Breakdown reporting and rescue flow
- [x] Frontend: Transporter fleet dashboard
- [x] Frontend: Admin fleet overview

### 1.6 Payment and Wallet
- [x] Backend: Initiate payment with M-Pesa-ready flow and dev STK simulation fallback
- [x] Backend: Escrow hold, release, refund, dispute foundation
- [x] Backend: Wallet endpoints and transaction history
- [x] Backend: Payment retry without duplicate records
- [x] Backend: Automated refund trigger on eligible cancellations
- [x] Frontend: Customer payment history and payment initiation workspace
- [x] Frontend: Admin payment dashboard and reconcile actions

### 1.7 Notifications
- [x] Backend: SMS, email, and push channel services with provider-ready integrations and dev fallbacks
- [x] Backend: Retry and fallback chain
- [x] Backend: Typed event dispatchers

### 1.8 Real-Time Tracking
- [x] Backend: WebSocket tracking gateway
- [x] Backend: Customer tracking endpoint
- [x] Backend: Admin live driver map endpoint
- [x] Frontend: Live map component
- [x] Frontend: Customer tracking page
- [x] Frontend: Socket.io client hook

### 1.9 Support Tickets
- [x] Backend: Create ticket linked to booking
- [x] Backend: Ticket lifecycle
- [x] Backend: Assign ticket to staff handler
- [x] Backend: Customer self-view for own tickets
- [x] Frontend: Customer support page
- [x] Frontend: Staff support panel

---

## Phase 1 Verification
- [x] Backend build passes: `backend/npm run build`
- [x] Frontend typecheck passes: `frontend/npx tsc --noEmit`
- [x] Frontend production build passes: `frontend/npm run build`

## Phase 1 Notes
- The repo now uses explicit role routes such as `/admin/*`, `/customer/*`, `/driver/*`, `/staff/*`, and `/transporter/*` instead of conflicting route-group placeholders.
- The stale duplicate plan file `backend/prd_plan.txt` was removed. Keep `backend/prd_plan_clean.txt` and the `docs/prd/` v10 files as the maintained references.
- Live M-Pesa credentials remain environment-driven. The repo now provides a build-safe M-Pesa initiation path with a dev fallback instead of a missing Phase 1 flow.
- Staff creation and listing now use real admin or agency scoping plus audit logging instead of placeholder IDs.

---

## Phase 2: Warehouse and Inventory (Weeks 7-11)
Goal: Warehouse operations, scan checkpoints, loss detection, and returns/RTO.
- [x] 2.1 Warehouse backend: CRUD, zone/rack/bin creation, scoped access, capacity reporting
- [x] 2.1 Warehouse frontend: dashboard and bin management screens
- [x] 2.2 Inventory backend: item CRUD, owner segregation, movement history, dispatch ordering helpers
- [x] 2.2 Inventory frontend: inventory list and item detail screen
- [x] 2.3 Scan backend: checkpoint validation, vehicle load/unload, delivery confirmation
- [x] 2.3 Scan frontend: offline queue hook, barcode/manual scanner, warehouse scan screen
- [x] 2.4 Waybill and LR backend: booking-linked creation, type routing, audit lock, manifest PDF
- [x] 2.5 Loss-detection backend: mismatch checks, stale alerts, report workflow, high-value approval
- [x] 2.5 Loss-detection frontend: admin and warehouse operational workspace
- [x] 2.6 Return and RTO backend: initiate, lifecycle transition, warehouse receipt, list/detail
- [x] 2.7 Fuel backend: trip logs, variance checks, abnormal-usage alerts
- [x] 2.7 Fuel frontend: admin and transporter fuel reporting views

### Phase 2 Progress Notes
- Warehouse backend now has scoped access control, warehouse detail/update endpoints, and zone-level capacity/occupancy reporting.
- Inventory backend now records movement history per item, exposes item list/detail APIs, and keeps bin occupancy in sync with item placement.
- Scan backend now validates checkpoint rules, blocks unsupported movement, and supports vehicle load/unload plus delivery confirmation capture.
- Waybill backend now links parcels to bookings, auto-routes LR vs Waybill by service type, enforces audit lock, and generates driver-manifest PDFs.
- Loss-detection backend now supports mismatch checks, stale-item alerts, report listing, and high-value approval handling.
- RTO backend now exposes initiation, lifecycle updates, warehouse receiving, and record listing/detail endpoints.
- Fuel backend now records expected-vs-actual trip fuel usage, computes variance, flags abnormal usage, and raises internal alerts.
- Frontend coverage now exists for warehouse dashboard, bins, inventory, scan, loss-detection, and fuel reporting as required by the phased implementation plan.

## Phase 2 Verification
- [x] Backend build passes after Warehouse/Inventory implementation: `backend/npm run build`
- [x] Frontend typecheck passes after Warehouse/Inventory implementation: `frontend/npx tsc --noEmit`
- [x] Frontend production build passes after Warehouse/Inventory implementation: `frontend/npm run build`

## Phase 3: Finance and Billing (Weeks 12-15)
Goal: Rate cards, invoicing, B2B, SLA tracking, and reconciliation.
- [x] 3.1 Rate card backend: CRUD/listing, versioned updates, pricing calculation
- [x] 3.1 Rate card frontend: admin rate-card management and calculator UI
- [x] 3.2 Invoice backend: booking invoice generation, type assignment, audit lock on issue, approval gate
- [x] 3.2 Billing backend: warehouse billing formula and combined corporate invoice generation
- [x] 3.2 Invoice frontend: customer invoices, corporate outstanding invoices, admin approval dashboard
- [x] 3.3 Contract backend: corporate contract CRUD, active contract lifecycle, credit exposure sync
- [x] 3.3 Credit enforcement: block corporate booking creation when projected exposure exceeds contract limit
- [x] 3.3 Corporate frontend: bookings, invoices, and contracts portal coverage
- [x] 3.3 Admin frontend: contract management dashboard
- [x] 3.4 SLA backend: configurable service-type timers, breach detection, escalation flow, no-show handling
- [x] 3.5 Reconciliation backend: invoice or payment auto-match, mismatch detection, daily reporting
- [x] 3.5 Reconciliation frontend: admin dashboard and rerun controls
- [x] 3.6 Admin control backend: approval workflows for refunds, booking cancel, and payout override
- [x] 3.6 Admin control backend: dual authorization execution for financial operations
- [x] 3.6 Admin control frontend: approval queue dashboard and review controls
- [x] 3.6 Staff performance backend: bookings, tickets, approval work, and resolution metrics
- [x] 3.6 Staff performance frontend: admin staff performance dashboard
- [x] 3.7 Analytics backend: revenue by period, service, and agency; driver KPIs; warehouse utilization
- [x] 3.7 Retention backend: CLV, repeat rate, NPS proxy, and promo-loyalty-referral metrics
- [x] 3.7 Analytics frontend: admin analytics dashboard

### Phase 3 Progress Notes
- Rate cards are now manageable from the admin portal and drive booking price calculations through active versions.
- Booking completion now triggers invoice generation, with high-value invoices held in draft until approval and issue.
- Warehouse billing now uses the current schema's storage-unit-day approximation because the existing data model does not yet store a dedicated cubic-space billing field.
- Customer, corporate, and admin invoice screens are now live with PDF download payloads and finance workflow actions.
- Corporate bookings now run through active contract credit checks before creation, and corporate credit exposure is derived from outstanding invoices plus open uninvoiced bookings.
- The corporate portal now has dedicated bookings and contracts pages, and admins can manage contract terms from the web UI.
- SLA coverage now exists in the backend with service-type thresholds, live booking timer inspection, escalation levels, and driver no-show reassign or requeue handling.
- Reconciliation coverage now exists across backend and frontend with booking-reference auto-match, mismatch worklists, and a daily finance dashboard for admin review.
- The current payment schema still links payments to bookings rather than directly to standalone invoices, so warehouse and combined invoices fall back to invoice-number matching when possible and otherwise surface manual-review notes.
- Refund and admin booking-cancel actions now enter an approval queue before execution, and payout overrides require dual authorization before the payroll value is changed.
- The admin portal now includes `/admin/audit` and `/admin/staff-performance`, so high-risk approval work and staff ops metrics are visible in the same web surface.
- The admin portal now includes `/admin/analytics`, with revenue, driver, warehouse, and retention metrics combined into one operations dashboard.
- NPS is currently exposed as a rating-derived proxy score, and promo, loyalty, plus referral metrics are derived from wallet-transaction and audit-log conventions in the current schema.

## Phase 4: Intelligence Layer (Weeks 16-20)
Goal: Fraud detection, surge logic, route intelligence, heatmaps, and alerts.
- [x] 4.1 Fraud backend: GPS spoof, ghost trip, duplicate booking, and route anomaly detection
- [x] 4.1 Fraud backend: fraud review workflow and suspension controls
- [x] 4.1 Fraud frontend: admin fraud dashboard and review queue
- [x] 4.2 Surge backend: demand-supply ratio calculator per zone
- [x] 4.2 Surge backend: zone activation, peak-hour rules, and super-admin emergency override
- [x] 4.2 Surge frontend: surge tab in admin rate-cards dashboard with zone map and controls
- [x] 4.3 Route optimization backend: Google Directions pathing with fallback shortest-path calculation
- [x] 4.3 Route optimization backend: multi-stop sequence optimization, deviation alerts, and traffic-aware recalculation
- [x] 4.3 Route optimization frontend: customer route layer inside live tracking
- [x] 4.4 Heatmap backend: zone demand calculation, driver endpoint, and threshold controls
- [x] 4.4 Heatmap frontend: driver heatmap screen with move-to-zone suggestions
- [x] 4.5 Capacity planning backend: warehouse occupancy snapshots and zone-level saturation
- [x] 4.5 Capacity planning backend: fleet availability tracking across total, available, and dispatch-ready vehicles
- [x] 4.5 Capacity planning backend: overbooking prevention wired into booking creation
- [x] 4.5 Capacity planning backend: historical-demand forecast for the next planning window
- [x] 4.6 Internal alert backend: missing parcel, payment failure, delay, fraud, capacity, and driver-offline triggers
- [x] 4.6 Internal alert backend: routing to warehouse manager, accounts, dispatch, and super-admin recipients
- [x] 4.6 Internal alert frontend: admin alerts dashboard with trigger, route, and resolve controls
- [x] 4.7 System health backend: API failure-rate metrics and internal alert thresholds
- [x] 4.7 System health backend: Prisma slow-query logging, DB health checks, and Redis health checks
- [x] 4.7 System health backend: BullMQ listener support, vendor telemetry forwarding, and `/health`
- [x] 4.7 System health frontend: admin system-health dashboard
- [x] 4.8 Session and access backend: configurable inactivity timeout with session validation
- [x] 4.8 Session and access backend: Super Admin forced logout with audit-log invalidation
- [x] 4.8 Session and access backend: device and IP session logging plus suspicious-login internal alerts
- [x] 4.8 Session and access backend: re-authentication token flow for critical actions

### Phase 4 Progress Notes
- Fraud detection is now active with driver-vs-vehicle GPS divergence checks, ghost-trip detection based on missing scans, duplicate-booking clustering that uses idempotency-aware heuristics, and route-deviation checks against the booking stop corridor.
- Admin review is now available at `/admin/fraud`, including confirmation, false-positive handling, and direct suspension of flagged driver or customer accounts.
- Surge pricing is now active with configurable `SurgeZone` records, demand-vs-supply ratio calculation per zone, time-based peak-hour rules, zone activation or deactivation, and a Super Admin emergency override path.
- Booking pricing now applies live surge zone and peak-hour multipliers on top of the active rate card, and `/admin/rate-cards` now includes the PRD-required surge tab with a zone map and command table.
- Route optimization is now active with a dedicated backend module, Google Directions support when `GOOGLE_MAPS_API_KEY` is present, fallback shortest-path logic otherwise, multi-stop optimization, deviation alerts through `InternalAlert`, and live route rendering on the customer tracking page.
- Driver demand heatmap is now active through the new `/heatmap/driver` endpoint, threshold-based zone intensity scoring, and the `/driver/heatmap` screen with move-to-zone suggestions.
- Heatmap threshold controls are currently service-config based because the current Prisma schema has no dedicated persistent settings model for zone-intensity thresholds.
- Capacity planning is now active through `/capacity-planning/warehouse`, `/capacity-planning/fleet`, `/capacity-planning/forecast`, and booking-level `enforceLimit()` checks that block new requests when no warehouse space or fleet capacity is free.
- Warehouse occupancy planning currently uses live bin saturation as the real-time fullness signal because the current schema does not store a dedicated reserved-space ledger.
- Fleet planning currently treats capacity as global active fleet supply because the current vehicle schema does not have a direct agency foreign key.
- Internal alerts are now active through `/alerts/dashboard` and `/admin/alerts`, including trigger, routing, and resolution flows for the PRD signal set plus capacity and driver-offline escalation.
- System health is now active through `/health` and `/admin/system-health`, with runtime API-failure metrics, Prisma slow-query capture, and database or Redis reachability checks.
- BullMQ queue monitoring now attaches when `BULLMQ_ENABLED` is set and the runtime package plus Redis are available, while Sentry or Datadog forwarding activates when the relevant environment variables are configured.
- Session and access control is now active with session-bound JWTs, configurable inactivity expiry, suspicious-login internal alerts, `/auth/reauth`, and Super Admin forced logout.
- Inactivity expiry and forced logout now persist through schema-backed session records stored in `IdempotencyRecord`, so session invalidation survives process restarts.

## Phase 4 Verification
- [x] Backend build passes after Intelligence Layer completion: `backend/npm run build`
- [x] Frontend typecheck passes after Intelligence Layer completion: `frontend/npx tsc --noEmit`
- [x] Frontend production build passes after Intelligence Layer completion: `frontend/npm run build`

## Phase 5: Scale and Africa-Ready (Weeks 21-26)
Goal: Offline-first expansion, multi-currency, marketplace, and USSD fallback.
- [x] 5.1 Offline mode: local scan queue, conflict resolution, duplicate merge or reject, cached map snapshots, retry backoff
- [x] 5.2 Multi-currency and language support: backend currency config, rate-card conversion, next-intl packs, customer profile selector, preferred-currency quotes
- [x] 5.3 Marketplace and aggregator system: partner onboarding, approval workflow, opportunity publishing, fixed price or bidding, commission tracking, admin dashboard
- [x] 5.4 Partner onboarding: driver referrals, joining bonuses, bulk fleet onboarding, funnel analytics
- [x] 5.5 Multi-country expansion rules: country pricing config, cross-border handoff tracking, inter-agency settlement
- [x] 5.6 USSD fallback: menu tree, session state, booking or tracking or payment flow, SMS confirmation

### Phase 5 Progress Notes
- Offline scan sync now carries a stable client reference and original occurrence time, so retries are idempotent and reconnect sync can apply “latest valid scan wins” conflict handling.
- Scan APIs now merge duplicate checkpoint submissions, reject stale offline scan events when a newer valid scan already exists, and log those sync outcomes in audit records.
- Warehouse scan UI now stores queued scans locally, syncs them with retry backoff, and shows resolved outcomes from the backend instead of treating every reconnect as a blind success.
- Map components now cache the latest live-tracking and driver-heatmap snapshots locally, so the route board and demand map can fall back to cached data during weak or missing connectivity.
- Supported currencies are now configured from the backend app config, and the rate-card engine can return quotes in KES, UGX, TZS, RWF, NGN, GHS, or ZAR while keeping KES as the operational base currency.
- Customer language and currency preferences now persist through schema-backed user preference records, and the frontend uses `next-intl` language packs for English, Kiswahili, French, and Amharic.
- Customer and corporate booking confirmation flows now display converted preferred-currency quote previews from the live rate-card calculation endpoint before the booking is created.
- Marketplace mode is now active through a dedicated backend module plus `/admin/marketplace`, with transporter and warehouse-partner onboarding, approval or suspension workflow, service-area matching, fixed-price acceptance, open-bid or negotiation flows, and commission tracking per awarded transaction.
- Marketplace partner review and low-performance monitoring now raise internal alerts for admin follow-up, while partner scorecards use awarded-booking completion, delay, bid conversion, and fraud signals from the current schema-backed implementation.
- Partner onboarding is now active through driver referral registration and conversion, joining-bonus wallet credits, transporter bulk fleet onboarding, and the new onboarding-funnel analytics endpoint for registered-to-verified-to-active supply tracking.
- Multi-country expansion rules are now active through backend country pricing overlays for Kenya, Uganda, Tanzania, and Rwanda, plus cross-border agency handoff records with parcel-scan confirmation and inter-agency settlement generation.
- USSD fallback is now active through `/ussd`, with a persisted menu-session flow for booking, tracking, and M-Pesa payment initiation plus SMS confirmation after USSD booking or payment actions.
- Multi-region deployment itself remains environment-driven rather than repo-provisioned. The codebase now exposes country config and settlement logic, but actual Render or AWS regional rollout still depends on runtime infrastructure setup.

## Phase 5 Verification
- [x] Backend build passes after Phase 5 completion: `backend/npm run build`
- [x] Frontend typecheck passes after Phase 5 completion: `frontend/npx tsc --noEmit`
- [x] Frontend production build passes after Phase 5 completion: `frontend/npm run build`

## Post-Phase Expansion Addendum
Goal: Extend PRD v10 with owned-fleet and courier-company supply-chain workflows beyond the original five-phase rollout.

- [x] External PRD master re-synced into `docs/prd/ZITO_PRD_v10_ULTIMATE.docx`
- [x] Repo PRD text export regenerated with Section `58. Courier Company & Owned Fleet Expansion Addendum`
- [x] Schema addendum: `COURIER_COMPANY` role plus vehicle ownership relation
- [x] Backend: fleet APIs scoped by owner account for customer, corporate, courier-company, and transporter roles
- [x] Backend: courier-company booking endpoints with load/unload validation and self-scope access
- [x] Frontend web: customer owned-fleet workspace
- [x] Frontend web: corporate owned-fleet workspace
- [x] Frontend web: separate courier-company portal with bookings, fleet, and multi-stop PTL request flow
- [x] Finance automation: platform-fee charging per vehicle or per fleet
- [x] Mobile expansion: courier-company and customer-owned-fleet mobile workspaces

### Expansion Notes
- Courier-company mode is now a formal PRD requirement, not an informal backlog idea. It is documented in the repo PRD as Section `58`.
- Multi-load and multi-unload rules are now explicitly captured and enforced at booking validation level through ordered stop sequences.
- Expo mobile now includes a courier-company tab workspace plus customer-owned-fleet management, so the new role and owned-fleet scope exist across both web and mobile surfaces.
- Platform-fee automation is now active through admin billing generation, role-aware fee defaults, idempotent billing windows, and invoice visibility for customer, courier-company, transporter, and corporate account flows.
- Per-vehicle platform-fee charging uses the current ACTIVE owned-fleet snapshot when available, because the current schema still has no dedicated retired-at history for perfect historical fleet reconstruction.
- Payments now link directly to invoices when available, and reconciliation prefers invoice-linked matching first while preserving booking or invoice-number fallback for older finance records.
