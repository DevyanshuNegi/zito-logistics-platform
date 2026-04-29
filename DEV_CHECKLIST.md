# ZITO DEV CHECKLIST

This file tracks the end-to-end development of the ZITO Super App based strictly on the PRD (`docs/prd/ZITO_PRD_v10_ULTIMATE.docx`) and the `prd_plan_clean.txt` implementation plan.

> **Current Focus:** Finish Phase 1 first.

---

## Phase 1: Core Platform (Weeks 1-6)
**Goal:** Customers can register, book a trip, pay, and track it. Drivers receive jobs and update status. Admins manage everything.

### 1.1 Authentication & Users (PRD §2, §3, §4)
- [x] Backend: Auth module (login, JWT, refresh token)
- [x] Backend: OTP flow (send, verify, rate limit)
- [x] Backend: User registration + KYC document upload
- [x] Backend: Account lifecycle (PENDING → VERIFIED → ACTIVE)
- [ ] Frontend: Login page, Register page, OTP verify, pending-approval
- [ ] Frontend: Role selection screen
- [x] Backend: JWT guard, roles guard, RBAC decorators

### 1.2 Agency Setup (PRD §31)
- [x] Backend: Agency CRUD (create, update, list, deactivate)
- [x] Backend: Agency controller with RBAC
- [ ] Frontend: Admin agency dashboard

### 1.3 Booking Engine (PRD §6)
- [x] Backend: Create booking (multi-stop, serviceType, pricing)
- [x] Backend: Full status lifecycle with audit log
- [x] Backend: Cancellation with reason + refund logic
- [x] Backend: Idempotency key enforcement on booking create
- [x] Backend: Admin booking list, assign driver, override status
- [ ] Frontend: Customer booking list + detail + cancel
- [ ] Frontend: Customer new booking wizard
- [ ] Frontend: Admin bookings dashboard

### 1.4 Driver System (PRD §8, §44.1, §44.2)
- [x] Backend: Driver profile (create, GPS update, online/offline)
- [ ] Backend: Driver matching engine
- [x] Backend: Shift system (start/end shift, hours calc)
- [x] Backend: ShiftActiveGuard
- [ ] Backend: Payroll engine (trip earnings, incentives)
- [ ] Frontend: Driver dashboard (jobs list, accept/reject)
- [ ] Frontend: Shift control screen
- [ ] Frontend: Earnings screen

### 1.5 Fleet & Vehicle (PRD §9)
- [ ] Backend: Vehicle CRUD (add, edit, assign to driver)
- [x] Backend: Insurance / permit expiry tracking with alerts
- [x] Backend: Dual GPS tracking (driver vs vehicle device)
- [ ] Backend: Breakdown reporting and rescue flow
- [ ] Frontend: Transporter fleet dashboard
- [ ] Frontend: Admin fleet overview

### 1.6 Payment & Wallet (PRD §15)
- [ ] Backend: Initiate payment (M-Pesa STK push)
- [x] Backend: Escrow (hold on booking, release on delivery)
- [x] Backend: Wallet (credit/debit with idempotency)ee cancellation
- [ ] Frontend: Customer payment history
- [ ] Frontend: Admin payment dashboard + manual reconcile

### 1.7 Notifications (PRD §22)
- [x] Backend: SMS, Email, Push channels integration
- [x] Backend: Retry + fallback logic
- [x] Backend: Booking events trigger

### 1.8 Real-Time Tracking (PRD §26)
- [ ] Backend: WebSocket gateway (driver location broadcast)
- [x] Backend: Customer tracking endpoint (ETA + live location)
- [ ] Frontend: Live map component (driver pin + ETA)
- [ ] Frontend: Customer tracking page
- [ ] Frontend: Socket.io client hook

### 1.9 Support Tickets (PRD §25, §36)
- [ ] Backend: Create ticket (linked to booking)
- [ ] Backend: Ticket lifecycle (OPEN → IN_PROGRESS → RESOLVED)
- [ ] Frontend: Customer support page
- [ ] Frontend: Staff support panel

---

## Phase 2: Warehouse & Inventory (Weeks 7-11)
**Goal:** Warehouse operations, scan checkpoints, loss detection, Returns/RTO.
- [ ] 2.1 Warehouse Management (Capacity tracking, Multi-agency, Dashboards)
- [ ] 2.2 Inventory System (FIFO/FEFO, Movement history, Details)
- [ ] 2.3 Scan System (Barcode block/validation, Load mapping, Offline queue)
- [ ] 2.4 Waybill / LR System (PDF generation, Audit locks)
- [ ] 2.5 Loss Detection (Batch mismatches, Stale alerts, Dual approval)
- [ ] 2.6 Return / RTO System (Lifecycles & receipt)
- [ ] 2.7 Fuel Management (Logs, Variance alerts)

---

## Phase 3: Finance & Billing (Weeks 12-15)
**Goal:** Rate cards, auto-invoicing, B2B, SLA tracking, Payment reconciliation.
- [ ] 3.1 Rate Card System (Dynamic pricing)
- [ ] 3.2 Invoice & Billing (Combined invoices, Auto generation)
- [ ] 3.3 B2B Contract System (Credit limits, corporate portal)
- [ ] 3.4 SLA System (Delay detection, Escalation rules)
- [ ] 3.5 Payment Reconciliation (Auto-match, Daily reports)
- [x] 3.6 Admin Control System (Dual auth for high-risk actions) *(Audit module scaffolded)*
- [ ] 3.7 Analytics (Revenue, Driver KPIs, Warehouse KPIs)

---

## Phase 4: Intelligence Layer (Weeks 16-20)
**Goal:** Fraud detection, Route AI, Heatmaps, Surges.
- [ ] 4.1 Fraud Detection (GPS spoof, Ghost trips)
- [ ] 4.2 Surge Pricing (Demand/supply ratio per zone)
- [ ] 4.3 Route Optimization (Directions API, traffic recalculation)
- [ ] 4.4 Driver Demand Heatmap
- [ ] 4.5 Capacity Planning (Forecasting, Overbooking blocks)
- [ ] 4.6 Internal Alert System (Multi-channel escalation)
- [ ] 4.7 System Health Monitoring (API failure rate, Prisma logs)
- [ ] 4.8 Session & Access Control (Auto-logout, Device IP tracking)

---

## Phase 5: Scale & Africa-Ready (Weeks 21-26)
**Goal:** Offline-first, Multi-currency, Aggregator Marketplace, USSD.
- [ ] 5.1 Offline Mode Constraints
- [ ] 5.2 Multi-Currency & Language Support
- [ ] 5.3 Marketplace / Aggregator System (Bidding, Commission)
- [ ] 5.4 Partner Onboarding (Referrals, Bulk sync)
- [ ] 5.5 Multi-Country Expansion Rules
- [ ] 5.6 USSD Fallback Paths
