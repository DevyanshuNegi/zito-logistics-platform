# Zito Testing Document

**Source PRD:** `docs/prd/ZITO_PRD_v10_ULTIMATE.txt`  
**Related QA Source:** `PRD_COMPLIANCE_TEST_PLAN.md`  
**Purpose:** End-to-end test strategy and execution checklist for Zito.

## 1. Test Objectives

- Verify PRD-critical flows across customer, partner, and internal surfaces.
- Confirm API role enforcement, not only UI hiding.
- Confirm booking, payment, warehouse, and support workflows are auditable.
- Validate provider failures are handled safely and clearly.
- Prove mobile layouts work on small Android screens and modern phones.

## 2. Test Environments

| Environment | Purpose |
|---|---|
| Local | Developer smoke tests, API verification, Expo/web UI checks |
| Preview/Staging | End-to-end integration with test provider credentials |
| Production | Live monitoring, smoke tests only, no destructive test data |

Local defaults:

- Backend: `http://127.0.0.1:5000`
- Frontend: `http://127.0.0.1:3001`
- Swagger: `http://127.0.0.1:5000/api/docs`

Before testing provider flows, verify local proxy variables are not forcing traffic through `127.0.0.1:9`.

## 3. Test Data Requirements

Create or seed test users for:

- Individual customer
- Corporate shipper
- Driver
- Agent
- Transporter
- Courier company
- Warehouse partner
- Admin
- Head office staff
- Agency staff: operations, customer care, accounts

Test data should include:

- At least one active vehicle and one unavailable vehicle.
- At least one warehouse with zones, racks, bins, and inventory.
- Rate cards for courier, PTL, FTL, warehouse, urgent service.
- Payment sandbox credentials or manual fallback mode.
- OTP test number and email inbox.

## 4. Smoke Test Suite

| Area | Test | Expected Result |
|---|---|---|
| Backend health | `GET /api/v1/health` | 200 OK with database UP |
| Web app | Open `/login` | Login renders without console crash |
| Mobile app | Expo starts and QR opens | Splash and login render with no bundling crash |
| Auth provider | Send phone OTP | OTP provider accepts request or returns provider-safe error |
| Role redirect | Verified login | User lands in correct role workspace |
| Dashboard | Each role dashboard opens | No blank screen; primary KPIs/actions visible |

## 5. Authentication Tests

### Phone OTP

- Enter phone number.
- Confirm masked verification target.
- Confirm OTP field focuses immediately.
- Paste a full six-digit OTP.
- Confirm auto-submit or clear verification action.
- Confirm role redirect after successful verification.

Expected:

- OTP valid for configured TTL.
- Resend disabled during cooldown but remains visible.
- Old OTP field clears after resend.
- Provider failure does not show provider brand to user.

### Email OTP and Password

- Enter email.
- Verify email OTP.
- Confirm password step appears only after OTP verification.
- Complete password.
- Confirm role redirect.

Expected:

- No password field on initial contact step.
- Email/password fallback remains inside same login flow when allowed.

### Lockout and Security

- Submit invalid OTP repeatedly.
- Confirm attempts remaining.
- Confirm lock after configured attempt count.
- Confirm expired OTP is rejected.
- Confirm used OTP cannot be reused.

## 6. Role Access Tests

| Test | Expected Result |
|---|---|
| Customer accesses driver earnings API | 403 or safe denial |
| Partner accesses internal admin route | 403 or redirect unauthorized |
| Internal staff accesses staff workspace | Allowed according to department |
| Public login exposes internal role selection | Must not happen |
| User with multiple roles chooses allowed workspace | Only valid role surfaces visible |

## 7. Booking Lifecycle Tests

Run a full booking through:

`CREATED -> SEARCHING -> APPROVED -> ASSIGNED -> ACCEPTED -> ARRIVED -> PICKED -> IN_TRANSIT -> ARRIVED_AT_DESTINATION -> DELIVERY_VERIFICATION -> DELIVERED -> PAYMENT_PENDING -> COMPLETED`

Validate:

- Each transition is allowed only from valid previous state.
- Audit trail records status changes.
- Driver cannot skip required states.
- Customer can track live status.
- Delivery verification requires OTP or approved proof flow.
- Completion triggers payment/invoice workflow.

Cancellation tests:

- Cancel before assignment.
- Cancel after acceptance if policy allows.
- Validate penalty/refund rules.

## 8. Payment Tests

| Flow | Expected Result |
|---|---|
| Quote generation | Correct rate, service type, currency, surcharge |
| M-Pesa STK push | Transaction created, status updates after callback/query |
| Manual fallback | Payment can be recorded with audit trail |
| Escrow hold | Funds held after approval/assignment as configured |
| Escrow release | Funds released after delivery/completion |
| Refund | Refund transaction and booking/payment status updated |
| Invoice | Invoice generated and linked to booking/payment |
| Reconciliation | Matched and unmatched transactions visible |

## 9. Tracking and Driver Tests

- Driver starts shift.
- Driver accepts booking.
- GPS updates are submitted.
- Customer tracking page updates.
- Route deviation alert triggers when applicable.
- Driver completes pickup, transit, delivery verification.
- Driver earnings and trip history update.
- SOS action creates alert and notifies configured channels.

## 10. Warehouse Tests

| Area | Test | Expected Result |
|---|---|---|
| Receiving | Scan inbound item | Inventory item and movement created |
| GRN | Receive expected vs actual quantity | Discrepancy captured |
| Damage | Mark damaged item with photo | Loss/support flow created |
| Bin movement | Move item between bins | Movement audit recorded |
| Pick/pack | Generate pick list and scan items | Correct inventory decrement/dispatch |
| Offline scan | Queue scans offline | Sync idempotently when online |
| Waybill | Dispatch shipment | Waybill generated and linked |

## 11. Support and Help Center Tests

- Contextual help opens from login, booking, tracking, payment, fleet, warehouse, and internal pages.
- AI/support assistant keeps workflow context.
- Human escalation creates support ticket with conversation summary.
- Ticket detail supports threaded messages.
- Support status changes are audited.

## 12. Dashboard Regression Tests

For each dashboard:

- Load on mobile-small, mobile-large, tablet/web where applicable.
- Confirm no text overflow.
- Confirm primary action buttons are visible.
- Confirm empty/loading/error states.
- Confirm role-specific data does not leak across users.
- Confirm quick actions navigate to expected existing routes.

Dashboards to verify:

- Customer home
- Driver dashboard/trips/earnings
- Agent opportunities
- Transporter dashboard/fleet/finance
- Courier company dashboard/bookings
- Warehouse dashboard/inventory
- Internal operations dashboard

## 13. Non-Functional Tests

| Category | Test |
|---|---|
| Performance | Dashboard load under realistic data volume |
| Reliability | Provider timeout and retry behavior |
| Security | RBAC, token expiry, session invalidation |
| Usability | OTP paste/autofill, small-screen layout, disabled states |
| Accessibility | Touch target size, contrast, readable labels |
| Observability | Logs capture provider/status errors without secrets |

## 14. Release Exit Criteria

- All critical auth, booking, payment, and dashboard smoke tests pass.
- No role leakage between customer, partner, and internal surfaces.
- OTP provider credentials validated in target environment.
- Payment sandbox/manual fallback validated.
- No white splash/loading background in mobile test build.
- No known blocking console errors on primary login/dashboard flows.

