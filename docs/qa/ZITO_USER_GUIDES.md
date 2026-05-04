# Zito User Guides

Last aligned with the current local system and PRD on `2026-05-03`.

## Purpose

This file is the working guide set for the current Zito app split:

- `Zito Logistics` = `CUSTOMER`, `CORPORATE`
- `Zito Partners` = `DRIVER`, `AGENT`, `TRANSPORTER`, `COURIER_COMPANY`, `WAREHOUSE_PARTNER`
- `Zito Internal` = `SUPER_ADMIN`, `ADMIN`, `AGENCY_STAFF`

Use this document to review real system behavior against the PRD and note where UX, role behavior, or workflows need refinement.

## Login Paths

- `Zito Logistics`: `http://127.0.0.1:3001/login`
- `Zito Partners`: `http://127.0.0.1:3001/partners/login`
- `Zito Internal`: `http://127.0.0.1:3001/internal/login`

## Auth Rules

- Phone OTP is the primary sign-in method.
- Email login is `OTP first`, then `password`.
- Only `ACTIVE` accounts can log in.
- OTP resend belongs inside the OTP step, not the contact step.
- Public registration must not expose internal roles.

## Service App Guide

### Individual Customer

- Use the customer app to create direct bookings, track delivery progress, manage payments, and raise tickets.
- Main routes:
  - `Home / Bookings`
  - `Book`
  - `Payments`
  - `Support`
  - `Fleet`
  - `Account`
- Core checks:
  - stop coordinates must be valid before booking confirmation
  - support tickets can be linked to a booking or raised as general requests
  - logout is inside Account

### Corporate

- Corporate users book and monitor loads under commercial terms.
- Main routes:
  - `Bookings`
  - `Fleet`
  - `Invoices`
  - `Contracts`
- Core checks:
  - company name belongs to registration, invoices, contracts, and approvals, not login
  - contract exposure and invoice exposure should be visible before more booking volume is pushed

## Partners App Guide

### Driver

- Driver uses the dedicated partner surface for:
  - `Dashboard`
  - `Jobs`
  - `Heatmap`
  - `Shift`
  - `Earnings`
- Core checks:
  - shift flow should be clear before accepting work
  - earnings and pending payout visibility should match payroll data

### Agent

- Agent is an external supply-side B2B partner, not an internal agency role.
- Agent registration must capture:
  - company legal name
  - authorized contact person
- Current working routes:
  - `Dashboard`
  - `Fleet`
  - `Drivers`
  - `Marketplace`
- Core checks:
  - agent can onboard drivers and vehicles under its own supply network
  - agent should see marketplace opportunities and commission visibility
  - agent must remain separate from `AGENCY_STAFF`

### Transporter

- Transporter is a B2B organization account, not an individual-only account.
- Registration must capture:
  - company legal name
  - authorized contact person
- Current working routes:
  - `Fleet`
  - `Invoices`

### Courier Company

- Courier Company runs county-to-county operations inside the courier portal.
- Current routes:
  - `Dispatch`
  - `Load Plans`
  - `New Movement`
  - `Scan Ops`
  - `Waybills`
  - `Owned Fleet`
  - `Invoices`
- Core checks:
  - capacity source should be explicit: `Owned Fleet`, `CFA Network`, `Blended`
  - scans, waybills, driver, vehicle, and booking chain should stay linked

### Warehouse Partner

- Warehouse Partner is also a B2B organization account.
- Current routes:
  - `Dashboard`
  - `Bins`
  - `Inventory`
  - `Scan`
  - `Loss`
- Core checks:
  - inventory ownership separation must stay visible
  - scan enforcement should preserve traceability

## Internal App Guide

### Super Admin / Admin

- Internal accounts use the private internal path only.
- Current admin control areas include:
  - `Alerts`
  - `System Health`
  - `Bookings`
  - `Analytics`
  - `Audit`
  - `Contracts`
  - `Fraud`
  - `Invoices`
  - `Marketplace`
  - `Reconciliation`
  - `Rate Cards`
  - `Staff Performance`
  - `Agencies`
  - `Fleet`
  - `Loss`
  - `Payments`
- Core checks:
  - approval flow and activation flow should remain aligned with PRD
  - internal roles should never appear in customer or partner role pickers

### Agency Staff

- Agency Staff is internal only and should not self-register publicly.
- Current main routes:
  - `Support Queue`
  - linked warehouse operations
- Core checks:
  - support ticket assignment and closure should be visible
  - route access should remain role-scoped

## OTP UX Checklist

- OTP step must show:
  - masked verification target
  - change contact action
  - visible resend control
  - resend countdown
  - attempts remaining messaging when applicable
- Email users must see password only after OTP success.
- Phone users must not be forced into password after OTP.

## Current In-System Guide Pages

- `http://127.0.0.1:3001/guides/service`
- `http://127.0.0.1:3001/guides/partners`
- `http://127.0.0.1:3001/guides/internal`

## Review Use

Use this guide file when comparing:

- current implementation
- requested UX changes
- PRD rules
- role-based route split
- onboarding and login behavior
