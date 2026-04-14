# ZITO Manual Testing Checklist
## PRD v6 Compliant Testing - Phase 1 Sign-off

### Test Order (As Per Testing Addendum §4)
1. Health and auth
2. Role login and landing routes
3. Role access control matrix
4. Core admin operations
5. Vehicle and compliance setup
6. Booking lifecycle
7. Payments, reports, contracts
8. Help/SOS and complaints
9. Marketplace and bidding
10. Agency and transporter finance
11. Mobile-width portal checks

---

## 1. HEALTH & AUTH TESTS

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1.1 | API Health | GET `/api/v1/health` | 200 OK, { status: 'ok' } | ⬜ |
| 1.2 | Login - super_admin | POST `/auth/login` with credentials | 200 + JWT token | ⬜ |
| 1.3 | Login - operations_admin | POST `/auth/login` with credentials | 200 + JWT token | ⬜ |
| 1.4 | Login - finance_admin | POST `/auth/login` with credentials | 200 + JWT token | ⬜ |
| 1.5 | Login - customer | POST `/auth/login` with credentials | 200 + JWT token | ⬜ |
| 1.6 | Login - driver | POST `/auth/login` with credentials | 200 + JWT token | ⬜ |
| 1.7 | Login - transporter | POST `/auth/login` with credentials | 200 + JWT token | ⬜ |
| 1.8 | Login - agent | POST `/auth/login` with credentials | 200 + JWT token | ⬜ |
| 1.9 | Invalid login | POST `/auth/login` with wrong password | 401 Unauthorized | ⬜ |
| 1.10 | Expired token | Use expired JWT in header | 401 Unauthorized | ⬜ |

---

## 2. ROLE LOGIN & LANDING ROUTES

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 2.1 | super_admin lands on / | Login → GET `/api/v1/admin/stats` | 200 OK | ⬜ |
| 2.2 | finance_admin lands on /reports | Login → GET `/api/v1/admin/reports/bookings` | 200 OK | ⬜ |
| 2.3 | customer lands on /portal/customer | Login → GET `/api/v1/customer/dashboard` | 200 OK | ⬜ |
| 2.4 | driver lands on /portal/driver | Login → GET `/api/v1/driver/dashboard` | 200 OK | ⬜ |
| 2.5 | transporter lands on /portal/transporter | Login → GET `/api/v1/transporter/dashboard` | 200 OK | ⬜ |
| 2.6 | agent lands on /portal/agent | Login → GET `/api/v1/agent/dashboard` | 200 OK | ⬜ |
| 2.7 | agency lands on /portal/agency | Login → GET `/api/v1/agency/dashboard` | 200 OK | ⬜ |

---

## 3. ROLE ACCESS CONTROL MATRIX

### operations_admin DENIED:
| # | Route | Expected | Status |
|---|-------|----------|--------|
| 3.1 | GET `/api/v1/payments` | 403 Forbidden | ⬜ |
| 3.2 | GET `/api/v1/reports` | 403 Forbidden | ⬜ |
| 3.3 | GET `/api/v1/contracts` | 403 Forbidden | ⬜ |
| 3.4 | GET `/api/v1/settings` | 403 Forbidden | ⬜ |

### finance_admin DENIED:
| # | Route | Expected | Status |
|---|-------|----------|--------|
| 3.5 | GET `/api/v1/bookings` (admin list) | 403 Forbidden | ⬜ |
| 3.6 | GET `/api/v1/assignments` | 403 Forbidden | ⬜ |
| 3.7 | GET `/api/v1/drivers` (admin list) | 403 Forbidden | ⬜ |
| 3.8 | GET `/api/v1/fleet` | 403 Forbidden | ⬜ |
| 3.9 | GET `/api/v1/customers` (admin list) | 403 Forbidden | ⬜ |
| 3.10 | GET `/api/v1/transporters` (admin list) | 403 Forbidden | ⬜ |
| 3.11 | GET `/api/v1/verification` | 403 Forbidden | ⬜ |

### super_admin ALLOWED:
| # | Route | Expected | Status |
|---|-------|----------|--------|
| 3.12 | GET `/api/v1/admin/stats` | 200 OK | ⬜ |
| 3.13 | GET `/api/v1/admin/users` | 200 OK | ⬜ |
| 3.14 | GET `/api/v1/admin/bookings` | 200 OK | ⬜ |
| 3.15 | GET `/api/v1/admin/reports` | 200 OK | ⬜ |
| 3.16 | GET `/api/v1/payments` | 200 OK | ⬜ |

---

## 4. CORE ADMIN OPERATIONS

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 4.1 | PRD §5.1 KPIs - Total Bookings | GET `/admin/stats` | bookings.total present | ⬜ |
| 4.2 | PRD §5.1 KPIs - Active Bookings | GET `/admin/stats` | bookings.active present | ⬜ |
| 4.3 | PRD §5.1 KPIs - Pending Bookings | GET `/admin/stats` | bookings.pending present | ⬜ |
| 4.4 | PRD §5.1 KPIs - Total Revenue | GET `/admin/stats` | financial.totalRevenue present | ⬜ |
| 4.5 | PRD §5.1 KPIs - Pending Payments | GET `/admin/stats` | financial.pendingPayments present | ⬜ |
| 4.6 | PRD §5.1 - Pending Approvals | GET `/admin/stats` | pending_approvals.total > 0 | ⬜ |
| 4.7 | Create user | POST `/admin/users` | 201 Created | ⬜ |
| 4.8 | List users | GET `/admin/users` | 200 + user array | ⬜ |
| 4.9 | Update user | PATCH `/admin/users/:id` | 200 OK | ⬜ |
| 4.10 | Soft delete user | DELETE `/admin/users/:id` | 200 OK + soft delete | ⬜ |
| 4.11 | View deleted users | GET `/admin/users?include_deleted=true` | includes deleted | ⬜ |

---

## 5. VEHICLE & COMPLIANCE SETUP

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 5.1 | List vehicles | GET `/admin/vehicles` | 200 + vehicle array | ⬜ |
| 5.2 | Approve driver | PATCH `/admin/drivers/:id/approve` | 200 OK | ⬜ |
| 5.3 | Reject driver | PATCH `/admin/drivers/:id/reject` | 200 OK | ⬜ |
| 5.4 | Blacklist driver | PATCH `/admin/drivers/:id/blacklist` | 200 OK | ⬜ |
| 5.5 | Verify vehicle | PATCH `/admin/vehicles/:id/verify` | 200 OK | ⬜ |
| 5.6 | Compliance expiry block | Expired docs → assignment attempt | Blocked | ⬜ |

---

## 6. BOOKING LIFECYCLE

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 6.1 | Create booking (customer) | POST `/customer/bookings` | 201 + booking | ⬜ |
| 6.2 | Create booking (agent) | POST `/agent/bookings` | 201 + booking | ⬜ |
| 6.3 | Auto-assignment | Create booking with auto mode | Driver assigned | ⬜ |
| 6.4 | Manual assignment | PATCH `/admin/bookings/:id/assign` | Driver assigned | ⬜ |
| 6.5 | Driver accepts | PATCH `/bookings/:id/driver-accept` | status: accepted | ⬜ |
| 6.6 | Mark picked up | PATCH `/bookings/:id/status` → picked_up | status updated | ⬜ |
| 6.7 | Start transit | PATCH `/bookings/:id/status` → in_transit | status updated | ⬜ |
| 6.8 | Mark delivered | PATCH `/bookings/:id/status` → delivered | status updated | ⬜ |
| 6.9 | Complete trip | PATCH `/bookings/:id/status` → completed | status updated | ⬜ |
| 6.10 | POD required | Complete without POD | Error / block | ⬜ |
| 6.11 | Upload POD | POST `/bookings/:id/pod` | 200 OK | ⬜ |
| 6.12 | Cancel booking | POST `/bookings/:id/cancel` | status: cancelled | ⬜ |

---

## 7. PAYMENTS, REPORTS, CONTRACTS

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 7.1 | Booking report | GET `/admin/reports/bookings` | CSV/JSON data | ⬜ |
| 7.2 | Financial report | GET `/admin/reports/financial` | Revenue data | ⬜ |
| 7.3 | Driver report | GET `/admin/reports/drivers` | Driver stats | ⬜ |
| 7.4 | Export report | GET `/admin/reports/export?format=csv` | CSV file | ⬜ |
| 7.5 | M-Pesa STK push | POST `/payments/mpesa/stk` | STK prompt | ⬜ |
| 7.6 | M-Pesa callback | POST `/payments/mpesa/callback` | Processed | ⬜ |
| 7.7 | Generate invoice | POST `/invoices/generate` | PDF invoice | ⬜ |
| 7.8 | Download receipt | GET `/invoices/:id/receipt` | PDF receipt | ⬜ |

---

## 8. AGENT & AGENCY PORTALS

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 8.1 | Agent dashboard KPIs | GET `/agent/dashboard` | customers, bookings, activeBookings | ⬜ |
| 8.2 | Agent customers | GET `/agent/customers` | Customer list | ⬜ |
| 8.3 | Add customer (agent) | POST `/agent/customers` | 201 Created | ⬜ |
| 8.4 | Create booking for customer | POST `/agent/bookings` | 201 Created | ⬜ |
| 8.5 | Agency dashboard | GET `/agency/dashboard` | Sub-accounts, reports | ⬜ |
| 8.6 | Agency reports | GET `/agency/reports` | Agency-level data | ⬜ |

---

## 9. VIEW AS (SUPER ADMIN IMPERSONATION)

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 9.1 | Preview customer | GET `/customer/dashboard` + X-View-As-User | Customer data | ⬜ |
| 9.2 | Preview driver | GET `/driver/dashboard` + X-View-As-User | Driver data | ⬜ |
| 9.3 | Preview agent | GET `/agent/dashboard` + X-View-As-User | Agent data | ⬜ |
| 9.4 | Preview transporter | GET `/transporter/dashboard` + X-View-As-User | Transporter data | ⬜ |
| 9.5 | Preview agency | GET `/agency/dashboard` + X-View-As-User | Agency data | ⬜ |
| 9.6 | ops_admin denied View As | GET with X-View-As-User header | 403 Forbidden | ⬜ |
| 9.7 | finance_admin denied View As | GET with X-View-As-User header | 403 Forbidden | ⬜ |

---

## 10. HELP / SOS / COMPLAINTS

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 10.1 | Customer help ticket | POST `/help/tickets` | Ticket created | ⬜ |
| 10.2 | Driver help ticket | POST `/help/tickets` | Ticket created | ⬜ |
| 10.3 | SOS freeze | POST `/sos/trigger` | Trip status frozen | ⬜ |
| 10.4 | SOS unfreeze | POST `/sos/resolve` | Trip status restored | ⬜ |
| 10.5 | Complaint creation | POST `/complaints` | Complaint created | ⬜ |
| 10.6 | Complaint resolution | PATCH `/complaints/:id/resolve` | Status resolved | ⬜ |

---

## 11. AUDIT LOG

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 11.1 | View As logged | Check audit after View As | Entry exists | ⬜ |
| 11.2 | Assignment logged | Check audit after assign | Entry exists | ⬜ |
| 11.3 | Compliance action logged | Approve/reject logged | Entry exists | ⬜ |
| 11.4 | Sensitive override logged | Manual override logged | Entry exists | ⬜ |
| 11.5 | View audit logs | GET `/admin/audit-logs` | Log entries | ⬜ |

---

## 12. MOBILE / NARROW SCREEN CHECKS

| # | Test Case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 12.1 | Login on mobile (320px) | Chrome DevTools mobile | Layout OK | ⬜ |
| 12.2 | Customer portal mobile | Chrome DevTools mobile | Layout OK | ⬜ |
| 12.3 | Driver portal mobile | Chrome DevTools mobile | Layout OK | ⬜ |
| 12.4 | Agent portal mobile | Chrome DevTools mobile | Layout OK | ⬜ |
| 12.5 | Transporter portal mobile | Chrome DevTools mobile | Layout OK | ⬜ |
| 12.6 | Agency portal mobile | Chrome DevTools mobile | Layout OK | ⬜ |

---

## 13. NOTIFICATIONS MATRIX

| # | Event | Expected Notification | Status |
|---|-------|----------------------|--------|
| 13.1 | Booking created | Customer + Driver SMS/Email | ⬜ |
| 13.2 | Driver assigned | Driver notification | ⬜ |
| 13.3 | Status update | Customer notified | ⬜ |
| 13.4 | Invoice generated | Customer notified | ⬜ |
| 13.5 | SOS escalation | Admin notified | ⬜ |

---

## SIGN-OFF

**Tester Name:** _________________  **Date:** _________________

**Total Tests:** ___ **Passed:** ___ **Failed:** ___ **Skipped:** ___

**Critical Issues Found:**
1. 
2. 
3. 

**Recommendations:**

**Approved for Phase 1 Launch:** ⬜ Yes  ⬜ No (pending fixes)

**Sign-off:**
- QA Lead: _________________ Date: _________________
- Product Owner: _________________ Date: _________________
- Tech Lead: _________________ Date: _________________
