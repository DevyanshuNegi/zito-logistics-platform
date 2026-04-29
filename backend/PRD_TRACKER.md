# ZITO PRD Tracker

## Active Source
`docs/prd/ZITO_PRD_v10_ULTIMATE.docx` is the only PRD to follow in this repo.
`docs/prd/ZITO_PRD_v10_ULTIMATE.txt` is the searchable text export generated from the same file.

## Phase 1 Status
- Core Platform scope is implemented across the backend and the Next.js web portal.
- Verification completed with `backend/npm run build`, `frontend/npx tsc --noEmit`, and `frontend/npm run build`.
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
- Promo-code, loyalty-point, and referral metrics are currently exposed as an explicit readiness state because the current Prisma schema does not yet store those ledgers directly.

## Phase 4 Status
- Fraud-detection coverage from PRD section 44.7 is active with GPS spoof detection, ghost-trip detection, duplicate-booking heuristics, route-anomaly detection, fraud-flag review actions, suspension controls, and `/admin/fraud`.
- Surge-pricing coverage from PRD section 44.8 is active with zone demand-supply ratios, configurable peak-hour rules, surge-zone activation and deactivation, Super Admin override, live booking-price application, and the surge tab inside `/admin/rate-cards`.
- Route-optimization coverage from PRD section 44.17 is active with a dedicated backend module, Google Directions API support when configured, fallback shortest-path and multi-stop optimization logic, route-deviation alerts, dynamic recalculation, and the customer route layer inside `/customer/tracking/[bookingId]`.
- Driver-heatmap coverage from PRD section 44.21 is active with demand-vs-driver zone scoring, a driver-focused heatmap endpoint, threshold controls, `/driver/heatmap`, and a reusable heatmap layer component.
- Heatmap threshold persistence is currently configuration-based in service memory because the current Prisma schema has no dedicated settings model for this slice.

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
- Frontend portals: role-based admin, customer, corporate, driver, staff, transporter, and warehouse views covering the delivered Phase 1 to Phase 3 slices.
- Mobile flows: auth, customer booking or tracking, driver trips or earnings, and transporter dashboard or fleet workflows remain part of the wider PRD footprint.

## Follow-up Audit Hotspots
- Phase 4.5 through 4.8 remain open after fraud detection, surge pricing, route optimization, and heatmap: capacity planning, alerts, system health, and session-access control.
- Standalone warehouse and combined invoices still rely on booking or invoice-number references for reconciliation because the current payment schema is booking-linked rather than invoice-linked.
- Promo-code, loyalty-point, and referral execution models are still absent from the schema, so Phase 3 analytics exposes readiness state rather than a fully transactable retention program.
- Keep executable engineering tests for safety, but do not use old PRD versions as the functional source of truth anymore.
