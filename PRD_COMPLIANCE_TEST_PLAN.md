# PRD Compliance Testing Checklist

**PRD Version:** v10 ULTIMATE  
**Date:** May 6, 2026  
**Tester:** Automated Verification + Manual Validation Needed

---

## Critical Path Testing (Must Complete Before Go-Live)

### Authentication Flow
- [ ] **Test:** Phone OTP with 6-digit code
  - Expected: OTP valid for 5 minutes, max 5 resend attempts, auto-submit on complete
  - URL: http://127.0.0.1:3001 (NOT localhost:3000)
  - Evidence: Screenshot from canonical URL

- [ ] **Test:** Email OTP → Password flow
  - Expected: OTP first, then password entry screen
  - Requirement: No password field on initial contact step
  - Evidence: Sequential screenshots

- [ ] **Test:** Account lock on failed attempts
  - Expected: Account lock after 5 failed OTP attempts
  - Requirement: Lock message displayed to user
  - Evidence: Error message capture

### Booking Lifecycle (15-State Flow)
- [ ] **Test:** Customer booking creation (multi-stop)
  - Expected: created → searching → assigned → accepted → picked → in_transit → arrived_at_destination → delivery_verification → delivered → completed
  - Validation: All state transitions logged in audit trail
  - Evidence: Booking detail view showing final state

- [ ] **Test:** Booking cancellation with refund
  - Expected: Refund triggered automatically for eligible cancellations
  - Validation: Payment wallet updated
  - Evidence: Wallet transaction record

- [ ] **Test:** Driver assignment and delivery OTP
  - Expected: OTP generated on assignment, required for delivery
  - Validation: Delivery cannot be completed without OTP verification
  - Evidence: Screen showing OTP requirement blocked without code

### Payment Flow
- [ ] **Test:** M-Pesa payment initiation
  - Expected: STK push sent (or dev fallback)
  - Validation: Payment status updates correctly
  - Evidence: Payment transaction record

- [ ] **Test:** Wallet escrow and release
  - Expected: Funds held in escrow during trip, released on completion
  - Validation: Wallet balance updates after release
  - Evidence: Wallet history showing escrow → release

### Real-Time Tracking
- [ ] **Test:** Live driver GPS updates
  - Expected: Driver location updates in real-time on map
  - Validation: Customer can see live tracking
  - Evidence: Map screenshot with live marker

- [ ] **Test:** WebSocket connection stability
  - Expected: Tracking continues even with network latency
  - Validation: Failover to polling if WebSocket fails
  - Evidence: Continued updates visible

---

## Warehouse Operations Testing

### Goods Receiving Note (GRN)
- [ ] **Test:** Inbound scan and GRN creation
  - Expected: GRN generated automatically on first scan
  - Validation: Expected vs received quantity tracked
  - Evidence: GRN PDF generated and audit locked

- [ ] **Test:** Damage detection at GRN
  - Expected: Damage flagged, photos captured, quarantine assigned
  - Validation: Customer notified, claim workflow triggered
  - Evidence: Support ticket created automatically

- [ ] **Test:** Discrepancy handling
  - Expected: Short/excess/damaged variants handled separately
  - Validation: Loss detection records created
  - Evidence: Loss detection report view

### Warehouse Scanning
- [ ] **Test:** Offline scan queueing
  - Expected: Scans queued locally when offline
  - Validation: Scans sync automatically on reconnect
  - Evidence: Scan records appear in system after sync

- [ ] **Test:** Duplicate scan prevention
  - Expected: Duplicate scans merged, not duplicated
  - Validation: Single record in system for same item + location
  - Evidence: Scan history shows one entry for duplicate attempt

### Pick/Pack/Dispatch
- [ ] **Test:** Pick list generation
  - Expected: Pick list sorted by warehouse location (FIFO/FEFO)
  - Validation: Picker can scan items to confirm pick
  - Evidence: Pick list and confirmation scans in order

- [ ] **Test:** Outbound manifest
  - Expected: Manifest links picked items to vehicle and driver
  - Validation: Waybill or LR generated with manifest reference
  - Evidence: Manifest PDF and audit-locked record

---

## Finance & Billing Testing

### Rate Card Calculation
- [ ] **Test:** Live rate quote before booking
  - Expected: Quote shows correct rate based on route/service type
  - Validation: Multi-currency display works (KES, UGX, TZS, etc.)
  - Evidence: Quote screenshot with currency selector

- [ ] **Test:** Surge pricing activation
  - Expected: Rate increases during peak hours in surge zones
  - Validation: Surge zone indicator visible to customer
  - Evidence: Booking quote shows surge surcharge

### Invoice Generation & Reconciliation
- [ ] **Test:** Automatic invoice on booking completion
  - Expected: Invoice generated and locked when booking completes
  - Validation: High-value invoices held in draft until approval
  - Evidence: Invoice status transitions visible

- [ ] **Test:** Invoice reconciliation match
  - Expected: Invoice automatically matched to payment within 24hrs
  - Validation: Mismatch alerts generated if no match
  - Evidence: Reconciliation report showing matched invoices

- [ ] **Test:** Warehouse billing consolidation
  - Expected: Storage charges + transport charges combined into one invoice
  - Validation: Breakdown visible in invoice line items
  - Evidence: Invoice with warehouse + transport fees

### SLA & Escalation
- [ ] **Test:** SLA timer activation
  - Expected: Timer starts on booking assignment
  - Validation: Alert triggers if SLA breached
  - Evidence: SLA alert in admin dashboard

- [ ] **Test:** Driver no-show escalation
  - Expected: Booking requeued if driver doesn't accept
  - Validation: Driver reassigned automatically or manually
  - Evidence: Booking reassignment log

---

## Multi-Role Access Control Testing

### Role Segregation
- [ ] **Test:** Customer cannot see driver earnings
  - Expected: Earnings page hidden/inaccessible for customer
  - Validation: 403 Forbidden if attempted via API
  - Evidence: Access denied screenshot

- [ ] **Test:** Admin can see all agency staff performance
  - Expected: `/admin/staff-performance` shows all staff metrics
  - Validation: Agency Staff can only see their own metrics
  - Evidence: Dashboard view differences by role

- [ ] **Test:** Internal staff separate from partner login
  - Expected: AGENCY_STAFF cannot see `/customer/*` or `/driver/*` routes
  - Validation: Route access denied with proper error
  - Evidence: 403 error on unauthorized route attempt

---

## Offline & Resilience Testing

### Offline Scan Sync
- [ ] **Test:** Scan app works without network
  - Expected: Barcode scans recorded locally
  - Validation: Scans sync when network returns
  - Evidence: Same scans appear in system dashboard

- [ ] **Test:** Exponential retry backoff
  - Expected: Failed sync retries with increasing delays
  - Validation: No duplicate scan attempts
  - Evidence: Sync log showing retry timing

### Map Caching
- [ ] **Test:** Tracking map works offline
  - Expected: Last cached map data visible when offline
  - Validation: Reduced confidence indicator shown
  - Evidence: Map visible with offline notice

---

## Multi-Country & Multi-Language Testing

### Currency Conversion
- [ ] **Test:** KES to UGX booking quote
  - Expected: Quote converts and shows UGX rate
  - Validation: Conversion rate accurate for current date
  - Evidence: Quote screenshot showing both currencies

- [ ] **Test:** Invoice shows customer's currency
  - Expected: Invoice displays in customer's preferred currency
  - Validation: Conversion math correct
  - Evidence: Invoice PDF in selected currency

### Language
- [ ] **Test:** Kiswahili UI complete
  - Expected: All critical workflows available in Kiswahili
  - Validation: No missing translations
  - Evidence: Screenshots of key pages in Kiswahili

- [ ] **Test:** Language preference persists
  - Expected: User's language choice saved
  - Validation: Returns to same language on next login
  - Evidence: User profile shows selected language

---

## Courier Company & Owned Fleet Testing

### Courier Company Portal
- [ ] **Test:** Courier company login separate path
  - Expected: Login routed to courier-specific workspace
  - Validation: Different UI from customer app
  - Evidence: Screenshots showing separate interface

- [ ] **Test:** Multi-stop booking creation
  - Expected: Courier can create booking with 3+ pickup and 3+ delivery points
  - Validation: Stops sequenced correctly for routing
  - Evidence: Booking with multiple stops shows ordered stops

### Owned Fleet Management
- [ ] **Test:** Vehicle registration and approval workflow
  - Expected: Vehicle pending_verification → approved/rejected
  - Validation: All 5 required truck photos captured and reviewed together
  - Evidence: Verification status transitions in vehicle detail

- [ ] **Test:** Driver assignment to owned vehicle
  - Expected: Fleet owner can assign driver to vehicle
  - Validation: Driver can only operate assigned vehicle without override
  - Evidence: Trip shows correct vehicle-driver pairing

- [ ] **Test:** Platform fee billing on owned vehicles
  - Expected: Monthly fee charged per approved vehicle
  - Validation: Fee invoice generated automatically
  - Evidence: Platform fee line item in invoice

---

## Compliance & Audit Testing

### Document Expiry Enforcement
- [ ] **Test:** Expired insurance auto-suspend vehicle
  - Expected: Vehicle status changes to suspended on expiry date
  - Validation: Vehicle cannot be dispatched while suspended
  - Evidence: Vehicle shown as suspended in fleet dashboard

- [ ] **Test:** Verification dashboard expiry warnings
  - Expected: Dashboard shows expiring documents 30 days before expiry
  - Validation: Batch actions available for renewal reminder
  - Evidence: Verification dashboard warning list

### Audit Logging
- [ ] **Test:** All booking state changes logged
  - Expected: Every state transition includes user, timestamp, reason
  - Validation: Logs cannot be modified (audit lock)
  - Evidence: Audit log showing complete history

- [ ] **Test:** Financial audit trail
  - Expected: Every fee, payment, refund logged with approver
  - Validation: Reconciliation trace-back to original transaction
  - Evidence: Payment audit trail showing full chain

---

## Performance & Scaling Testing

### System Health Monitoring
- [ ] **Test:** API failure metrics captured
  - Expected: Admin dashboard shows API response times and error rates
  - Validation: Slow queries flagged in Prisma metrics
  - Evidence: System health dashboard data

- [ ] **Test:** Database and Redis health checks
  - Expected: `/health` endpoint returns status of all dependencies
  - Validation: Alerts triggered if any component unhealthy
  - Evidence: Health check endpoint response

### Load Testing
- [ ] **Test:** Concurrent booking creation
  - Expected: 100+ simultaneous booking requests processed
  - Validation: No race conditions or duplicate bookings
  - Evidence: Load test report showing successful throughput

---

## Sign-Off Requirements (Per PRD Section 57)

### Business Sign-Off
- [ ] Product/Operations: Workflow correctness and exception handling
  - **Owner:** ________________  
  - **Date:** ________________  
  - **Evidence:** ________________

### Finance Sign-Off
- [ ] Finance: Payment, wallet, invoice, refund flows
  - **Owner:** ________________  
  - **Date:** ________________  
  - **Evidence:** ________________

### Support Sign-Off
- [ ] Support: Ticketing, escalation, customer care
  - **Owner:** ________________  
  - **Date:** ________________  
  - **Evidence:** ________________

### Security Sign-Off
- [ ] Security: Authentication, audit, privacy, access control
  - **Owner:** ________________  
  - **Date:** ________________  
  - **Evidence:** ________________

### Technology Sign-Off
- [ ] Technology: APIs, data integrity, monitoring, infrastructure
  - **Owner:** ________________  
  - **Date:** ________________  
  - **Evidence:** ________________

---

## Go-Live Readiness Checklist (Section 57)

- [ ] All Phase 1 mandatory flows pass UAT (booking → completion → payment)
- [ ] No open critical defects in launch scope
- [ ] Monitoring, alerting configured in production
- [ ] Provider credentials, templates, rate cards deployed
- [ ] Support escalation roster and SOPs active
- [ ] Backup/restore and rollback drills completed
- [ ] Pilot validation completed and reviewed by operations

**Go-Live Release Date:** ________________  
**Approved By:** ________________  
**Date:** ________________

---

**Document Version:** 1.0  
**Next Review:** Post-UAT  
**Maintenance:** Update with each test execution
