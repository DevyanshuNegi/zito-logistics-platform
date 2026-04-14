# ZITO Testing Addendum

This addendum captures PRD items that are missing or only lightly covered in the current API testing document.

## 1. Role Control Matrix

Use this as the expected control ownership during testing:

| Role | Main landing page | Controls |
| --- | --- | --- |
| `super_admin` | `/` | Full platform control, settings, view-as, finance, operations |
| `operations_admin` | `/` | Bookings, assignments, drivers, fleet, customers, transporters, verification, complaints, help |
| `finance_admin` | `/reports` | Payments, reports, contracts, financial visibility only |
| `customer` | `/portal/customer` | Own bookings, tracking, receipts, ratings |
| `driver` | `/portal/driver` | Own trips, status updates, earnings, availability, documents |
| `transporter` | `/portal/transporter` | Own fleet, drivers, customers, bookings, transporter finance |
| `agent` | `/portal/agent` | Own customer portfolio, bookings, commissions |
| `agency` | `/portal/agency` | Own sub-accounts, reports, agency-level oversight |

Important PRD rule:
- `super_admin` can use `View As`.
- `operations_admin` cannot access finance-only pages.
- `finance_admin` cannot access operational pages or user-account management.

## 2. Missing Test Cases To Add

Add these cases to the main testing document before sign-off:

1. Login and landing page by role
- Verify each role logs in and lands on the correct home page.
- Verify `finance_admin` lands on `/reports`, not `/`.

2. UI route protection by role
- `operations_admin` denied: `/payments`, `/reports`, `/contracts`, `/settings`
- `finance_admin` denied: `/bookings`, `/assignments`, `/drivers`, `/fleet`, `/customers`, `/transporters`, `/verification`
- `super_admin` allowed on all admin pages

3. View As coverage
- `super_admin` preview customer
- `super_admin` preview agent
- `super_admin` preview driver
- `super_admin` preview transporter
- `super_admin` preview agency
- `operations_admin` and `finance_admin` denied when sending `X-View-As-User`

4. Call center and operations support
- Offline booking flow by support/admin
- Admin manual status update during support case
- Complaint handling and resolution flow

5. Help / SOS
- Customer help ticket creation
- Driver help ticket creation
- SOS freeze blocks trip status updates
- Admin unfreeze restores trip progression

6. Notifications matrix
- Booking created notification
- Driver assignment notification
- Status update notification
- Invoice generated notification
- SOS escalation notification

7. Soft delete and admin recovery visibility
- Deleted users hidden from normal queries
- Admin `include_deleted=true` behavior

8. Compliance expiry and assignment blocking
- Expired compliance documents force `resubmission_required`
- Driver cannot accept assignments after expiry block

9. Marketplace extras from PRD
- Open loads listing
- My bids
- Location interest
- Backhaul request

10. Document flows
- Driver document upload and re-submission
- Vehicle document verification and expiry alerts
- POD required for delivery

11. Audit log checks
- View As session logged
- Assignment changes logged
- Compliance actions logged
- Sensitive overrides logged

12. Mobile and narrow-screen checks
- Login on small screen
- Customer portal on small screen
- Driver portal on small screen
- Transporter portal on small screen
- Agent portal on small screen
- Agency portal on small screen

## 3. Mobile / APK Position From PRD

What the PRD clearly includes:
- `Driver App/Portal`
- Multi-role portals for customer, transporter, agent, agency, and admin
- Mobile-style use cases such as GPS, live tracking, trip updates, notifications, and SOS

What the PRD does **not** explicitly define:
- Android APK delivery
- iOS App Store delivery
- Separate mobile release plan or store submission scope

Implementation decision now provided:
- Native mobile app stack: `React Native (Expo)`
- APK delivery should come from the Expo mobile app build pipeline, not from the current web frontend

Recommended interpretation:
- Phase 1 supports mobile-ready portal usage and driver mobile workflow.
- Native APK/app packaging should be tracked as a parallel mobile scope using Expo.

## 4. Recommended Test Order

Run testing in this order:

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

## 5. Current Navigation Fix

The frontend was updated so `finance_admin` now lands on `/reports` instead of `/`, which avoids the false `unauthorized` page after successful login.
