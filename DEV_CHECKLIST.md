# ZITO DEV CHECKLIST

This file tracks the end-to-end development of the ZITO Super App based strictly on the PRD (`docs/prd/ZITO_PRD_v10_ULTIMATE.docx`) and the `prd_plan_clean.txt` implementation plan.

> **Current Focus:** Finish Phase 1 backend first, then frontend.
> **Last Updated:** 29 April 2026

---

## Phase 1: Core Platform (Weeks 1-6)
**Goal:** Customers can register, book a trip, pay, and track it. Drivers receive jobs and update status. Admins manage everything.

### 1.1 Authentication & Users (PRD §2, §3, §4)
- [x] Backend: Auth module (login, JWT, refresh token)
- [x] Backend: OTP flow — send, verify, rate limit, cooldown, account lock (`otp.service.ts` — uses `LoginOtp` + `LoginAttempt` schema models)
- [x] Backend: User registration + KYC document upload
- [x] Backend: Account lifecycle (PENDING → VERIFIED → ACTIVE)
- [x] Backend: JWT guard, roles guard, RBAC decorators (`jwt-auth.guard.ts`, `roles.guard.ts`, `roles.decorator.ts`)
- [ ] Frontend: Login page, Register page, OTP verify, pending-approval
- [ ] Frontend: Role selection screen

### 1.2 Agency Setup (PRD §31)
- [x] Backend: Agency CRUD (create, update, list, deactivate)
- [x] Backend: Agency controller with RBAC
- [x] Backend: Staff management — `staff.service.ts` (manual user join, no permissions field in schema yet)
- [ ] Frontend: Admin agency dashboard

### 1.3 Booking Engine (PRD §6)
- [x] Backend: Create booking (multi-stop, serviceType, pricing from RateCard)
- [x] Backend: Full 15-state lifecycle with audit log at every transition
- [x] Backend: Cancellation with reason + penalty logic (PRD §20 — 10% after ACCEPTED)
- [x] Backend: Idempotency key enforcement — in-memory Map with 24h TTL (no extra schema model needed)
- [x] Backend: Admin booking list, assign driver, override status, cancel
- [x] Backend: Driver trip list, status update, reject
- [x] Backend: Customer booking list, detail, cancel, rate (48h window)
- [x] Backend: Delivery OTP generated on assignment, verified on DELIVERED
- [ ] Frontend: Customer booking list + detail + cancel
- [ ] Frontend: Customer new booking wizard (3-step)
- [ ] Frontend: Admin bookings dashboard with filters

### 1.4 Driver System (PRD §8, §44.1, §44.2)
- [x] Backend: Driver profile (create, GPS update, online/offline toggle)
- [x] Backend: Driver matching engine — proximity, availability, vehicle type, capacity, rating threshold, active shift, no conflicting trip (`matching/matching.service.ts`)
- [x] Backend: Shift system — start/end shift, 12h max, 8h min rest, fatigue alert at 10h (`shift/shift.service.ts`)
- [x] Backend: ShiftActiveGuard — blocks trip acceptance without active shift
- [x] Backend: Payroll engine — trip earnings, hourly earnings, incentives, penalties, approve, mark-paid (`payroll/payroll.service.ts`)
- [ ] Frontend: Driver dashboard (jobs list, accept/reject)
- [ ] Frontend: Shift control screen (start/end shift)
- [ ] Frontend: Earnings screen (wallet balance, payroll history)

### 1.5 Fleet & Vehicle (PRD §9)
- [ ] Backend: Vehicle CRUD — add, edit, assign to driver, retire (`fleet.service.ts` — basic routes exist, full CRUD incomplete)
- [x] Backend: Insurance/permit expiry tracking with auto-suspend (`fleet-expiry.service.ts` — daily check, 15-day alert, suspends on expiry)
- [x] Backend: Dual GPS tracking — driver mobile vs vehicle hardware, divergence alert at 500m
- [ ] Backend: Breakdown reporting and rescue flow (`breakdown/breakdown.service.ts` — not built yet)
- [ ] Frontend: Transporter fleet dashboard
- [ ] Frontend: Admin fleet overview

### 1.6 Payment & Wallet (PRD §15)
- [ ] Backend: Initiate payment — M-Pesa STK Push (`/payments/initiate` route exists, Daraja API integration pending — Phase 2 key)
- [x] Backend: Escrow — hold on booking, release on delivery, refund, dispute, resolve (`escrow.service.ts`)
- [x] Backend: Wallet — credit/debit endpoints exist (`/payments/wallet/me`, wallet transactions)
- [ ] Backend: Payment retry without duplicates — `Payment.retryCount` in schema, retry logic pending
- [ ] Backend: Automated refund trigger on cancellation — escrow.refund() exists, not wired into booking cancel flow yet
- [ ] Frontend: Customer payment history
- [ ] Frontend: Admin payment dashboard + manual reconcile

### 1.7 Notifications (PRD §22)
- [x] Backend: SMS, Email, Push channel dispatch (Africa's Talking / Resend / FCM stubs — keys wired in Phase 2)
- [x] Backend: Retry + fallback chain (SMS → Email → Push, 3 retries with exponential backoff)
- [x] Backend: Typed event dispatchers (booking created, driver assigned, status changed, SOS, doc expiry)

### 1.8 Real-Time Tracking (PRD §26)
- [x] Backend: WebSocket gateway — `TrackingGateway` running (`driver:join`, `driver:location`, `customer:track`, `admin:map`)
- [x] Backend: Customer tracking endpoint — ETA + live driver location (`/tracking/booking/:bookingId`)
- [x] Backend: Admin live driver map (`/tracking/admin/drivers`)
- [ ] Frontend: Live map component (driver pin + ETA display)
- [ ] Frontend: Customer tracking page
- [ ] Frontend: Socket.io client hook (`useSocket.ts`)

### 1.9 Support Tickets (PRD §25, §36)
- [x] Backend: Create ticket linked to booking (`POST /support`)
- [x] Backend: Ticket lifecycle — OPEN → IN_PROGRESS → ESCALATED → RESOLVED → CLOSED
- [x] Backend: Assign ticket to staff handler (`PATCH /support/:id/assign`)
- [x] Backend: Customer view own tickets (`GET /support/my`)
- [ ] Frontend: Customer support page (raise + track ticket)
- [ ] Frontend: Staff support panel (view, assign, resolve)

---

## Phase 1 Backend Completion Status
| Module | Backend | Frontend |
|---|---|---|
| Auth & Users | ✅ Done | ⬜ Pending |
| Agency + Staff | ✅ Done | ⬜ Pending |
| Booking Engine | ✅ Done | ⬜ Pending |
| Driver System | ✅ Done | ⬜ Pending |
| Fleet & Vehicle | 🔶 Partial (CRUD + Breakdown pending) | ⬜ Pending |
| Payments | 🔶 Partial (M-Pesa + retry pending) | ⬜ Pending |
| Notifications | ✅ Done (stubs, keys in Phase 2) | — |
| Real-Time Tracking | ✅ Done | ⬜ Pending |
| Support Tickets | ✅ Done | ⬜ Pending |

---

## Phase 1 — Next Backend Items (in order)
1. `[ ]` Breakdown service — `src/modules/fleet/breakdown/breakdown.service.ts` (PRD §44.4)
2. `[ ]` Vehicle CRUD complete — `src/modules/fleet/fleet.service.ts`
3. `[ ]` Wire escrow refund into booking cancellation flow
4. `[ ]` Payment retry logic — `payments.service.ts`

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
- [ ] 3.1 Rate Card System (Dynamic pricing engine)
- [ ] 3.2 Invoice & Billing (Combined invoices, Auto generation)
- [ ] 3.3 B2B Contract System (Credit limits, corporate portal)
- [ ] 3.4 SLA System (Delay detection, Escalation rules)
- [ ] 3.5 Payment Reconciliation (Auto-match, Daily reports)
- [x] 3.6 Admin Control System (Audit interceptor scaffolded — `audit.interceptor.ts`)
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