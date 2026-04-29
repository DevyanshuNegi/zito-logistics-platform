# ZITO PRD Tracker

## Active Source
`docs/prd/ZITO_PRD_v10_ULTIMATE.docx` is the only PRD to follow in this repo.
`docs/prd/ZITO_PRD_v10_ULTIMATE.txt` is the searchable text export generated from the same file.

## Phase 1 Status
- Core Platform scope is now implemented across the backend and the Next.js web portal.
- Verification completed with `backend/npm run build`, `frontend/npx tsc --noEmit`, and `frontend/npm run build`.
- Remaining workstreams in this tracker should be treated as Phase 2+ expansion, not Phase 1 blockers.

## Legacy Cleanup
Legacy PRD files and PRD-linked testing documentation under `docs/prd/` and `docs/testing/` have been removed from the repo.
Stale top-level repo references to older PRD versions have been updated to point at the current baseline.

## New PRD Scope
- Identity and access: user roles, authentication, signup/KYC, staff login, advanced RBAC, and security.
- Core logistics: location, booking engine, driver matching, driver operations, fleet/vehicle, warehouse, inventory, barcode/scan, loss detection, LR/waybill, and real-time tracking.
- Finance and commercial control: payments and wallets, invoices, warehouse billing, multi-service billing, rate cards, contracts, accounting, and revenue model.
- Operations and support: admin operations, incidents, analytics, customer retention, agency management, staff management, customer support, customer care, internal alerts, internal audit, and multi-agency flow.
- Platform readiness: Africa-ready/offline behavior, notifications, architecture, backup/disaster recovery, API design, core data models, infrastructure/scaling, go-to-market, and partner onboarding.

## Repo Areas Already Carrying This PRD Forward
- Backend APIs: auth, OTP, users, bookings, booking offers, compliance, contracts, payments, admin ops, help, complaints, agency, transporter, and vehicle flows.
- Logistics Modules: LR/Waybill (PRD §14), Warehouse (PRD §10) with Controller, and Inventory (PRD §11).
- Frontend portals: bookings, compliance, contracts, driver/transporter/customer views, payments, reports, audit log, complaints, notifications, and settings.
- Mobile flows: auth, customer booking/history/tracking, driver trips/earnings/SOS, and transporter dashboard/fleet/bookings/finance.

## Follow-up Audit Hotspots
- Loss-detection now has scaffold coverage in the repo, but it remains a Phase 2 workstream rather than completed end-to-end product flow.
- Expanded back-office areas in the new PRD such as staff management, internal alerts, customer care, retention/engagement, fuel/payroll/attendance, and partner onboarding should be reviewed as separate implementation workstreams.
- Keep executable engineering tests for safety, but do not use old PRD versions as the functional source of truth anymore.
