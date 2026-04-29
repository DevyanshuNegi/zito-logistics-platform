# ZITO DEV CHECKLIST

This file tracks development against the PRD v10 source set:

- `docs/prd/ZITO_PRD_v10_ULTIMATE.docx`
- `docs/prd/ZITO_PRD_v10_ULTIMATE.txt`
- `docs/prd/ZITO_Phased_Implementation_Plan.docx`
- `backend/prd_plan_clean.txt`

> Current Focus: Phase 1 complete. Phase 2 warehouse and inventory is next.
> Last Updated: 29 April 2026

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
- [x] Backend: Staff management service coverage
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
- [x] Backend: SMS, email, and push channel dispatch scaffolds
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

---

## Phase 2: Warehouse and Inventory (Weeks 7-11)
Goal: Warehouse operations, scan checkpoints, loss detection, and returns/RTO.
- [ ] 2.1 Warehouse management
- [ ] 2.2 Inventory system
- [ ] 2.3 Scan system
- [ ] 2.4 Waybill and LR system
- [ ] 2.5 Loss detection
- [ ] 2.6 Return and RTO system
- [ ] 2.7 Fuel management

## Phase 3: Finance and Billing (Weeks 12-15)
Goal: Rate cards, invoicing, B2B, SLA tracking, and reconciliation.
- [ ] 3.1 Rate card system
- [ ] 3.2 Invoice and billing
- [ ] 3.3 B2B contract system
- [ ] 3.4 SLA system
- [ ] 3.5 Payment reconciliation
- [x] 3.6 Admin control scaffolding
- [ ] 3.7 Analytics

## Phase 4: Intelligence Layer (Weeks 16-20)
Goal: Fraud detection, surge logic, route intelligence, heatmaps, and alerts.
- [ ] 4.1 Fraud detection
- [ ] 4.2 Surge pricing
- [ ] 4.3 Route optimization
- [ ] 4.4 Driver demand heatmap
- [ ] 4.5 Capacity planning
- [ ] 4.6 Internal alert system
- [ ] 4.7 System health monitoring
- [ ] 4.8 Session and access control

## Phase 5: Scale and Africa-Ready (Weeks 21-26)
Goal: Offline-first expansion, multi-currency, marketplace, and USSD fallback.
- [ ] 5.1 Offline mode
- [ ] 5.2 Multi-currency and language support
- [ ] 5.3 Marketplace and aggregator system
- [ ] 5.4 Partner onboarding
- [ ] 5.5 Multi-country expansion rules
- [ ] 5.6 USSD fallback
