# PRD Updates — Delivery OTP Security Enhancements
## Marketplace & Warehouse Booking Update
**Date:** May 23, 2026
**Status:** COMPLETE

### Summary

The master PRD has been updated to make the marketplace and warehouse booking requirements explicit. The warehouse flow requires warehouse partners to list warehouses online, admin to verify and approve listings, customers to book approved warehouses online, and Zito to record a default 10% warehouse-partner commission on bookings.

### PRD Sections Updated

- Section 10 - Warehouse System:
  - warehouse partner listing submission
  - admin review, approval, change request, rejection, and suspension flow
  - customer online warehouse booking discovery
  - listing fields for company details, VAT, documents, photos, rates, capacity, area, and location
  - booking status lifecycle and capacity reservation rules
  - 10% default Zito commission requirement

- Section 44.20 - Marketplace / Aggregator Mode:
  - first-class partner types: Agent, Transporter, Courier Company, Warehouse Partner
  - partner profile controls, service areas, linked assets, approval state, premium listings, and suspension
  - fixed-price, open-bid, and negotiation opportunity flows
  - awarded-work commission, service fee, premium listing fee, partner net amount, and audit requirements
  - warehouse listings as independently reviewed supply, separate from partner profile approval

- Section 66.7 - Customer Booking Experience:
  - customer-safe warehouse booking requirements
  - approved listing facts visible to customers
  - internal commission math hidden from customer surfaces
  - warehouse booking does not open the transport booking form first

- Backend PRD Tracker:
  - Phase 5 status now includes active marketplace and warehouse listing/booking coverage.

---

## Delivery OTP Security Enhancements
**Date:** May 6, 2026  
**Status:** ✅ COMPLETE

---

## Summary of PRD Changes

The ZITO PRD v10 ULTIMATE has been updated to formally document all delivery OTP security enhancements implemented in the codebase. All changes are now part of the official product requirements.

---

## Changes Made to PRD

### 1. **Section 12 — Barcode & Scan System: Delivery Proof System**

#### ADDED: Delivery OTP Security (Enhanced Security Control)
New subsection documenting delivery OTP security requirements:

- OTP generated as 4-digit code and hashed using bcrypt (10 rounds) before database storage
- OTP never stored in plain text at rest
- OTP verification uses bcrypt.compare() for time-safe comparison
- Maximum 5 verification attempts per booking delivery
- **After 5 failed OTP attempts → booking locked for 15 minutes (automatic lockout)**
- Attempt counter increments on each failed verification; resets to 0 on success
- Lockout status clearly communicated to driver ("try again after X minutes")
- Admin may manually unlock booking after lockout period expires
- Rate limiting applies to all delivery OTP verification endpoints:
  - Booking status update (driver app)
  - Warehouse scan confirmation

**Reference in PRD:** Lines 346-355

---

### 2. **Section 3 — Authentication System: OTP Handling & Security Rules**

#### UPDATED: OTP Storage Specification
- Changed from vague "stored hashed at rest" to **specific "using bcrypt with 10 rounds"**
- Added requirement: **"OTP verification must use secure comparison (bcrypt.compare) to prevent timing attacks"**

#### ADDED: Delivery OTP Rate Limiting Subsection
New detailed subsection explaining rate limiting scope and behavior:

- Applies to all delivery confirmation OTP attempts across system
- Maximum 5 consecutive failed verification attempts per booking
- **After 5 failed attempts → booking locked state for 15 minutes**
- During lockout → additional OTP verification attempts rejected with lockout message
- **Lockout automatically cleared after 15 minutes**
- Successful OTP verification resets attempt counter to 0 and clears any lockout
- Rate limiting applies across **both delivery verification paths:**
  - Driver app status update
  - Warehouse scan-based delivery confirmation
- Failed attempt counter increments regardless of verification method

**Reference in PRD:** Lines 120-128

---

### 3. **Section 28 — Security**

#### ADDED: OTP & Sensitive Code Security Subsection
New security requirements section:

- All OTP codes (authentication and delivery) must be hashed using bcrypt (10 rounds) before database storage
- OTP verification must use bcrypt.compare() for time-safe comparison to prevent timing attacks
- **Authentication OTP specs:** 5 min validity, 5 max resend, account lock after 5 failed verifications
- **Delivery OTP specs:** 4-digit code, hashed storage, 5 max attempts, **15-min booking lockout after 5 failed attempts**
- **Delivery OTP lockout is automatic and non-bypassable**
- Manual unlock by admin only after lockout period expires
- All OTP failures and lockouts logged with timestamp and user/booking identity

**Reference in PRD:** Lines 743-749

---

### 4. **Section 46 — CORE DATA MODELS**

#### UPDATED: Booking Model Definition
Expanded Booking entity definition to include security fields:

```
Booking
- id, customer_id, status, route, price
- deliveryOtp (hashed with bcrypt), deliveryOtpAttempts (int, default 0), deliveryOtpLockedUntil (DateTime, nullable)
- deliveryProofUrl, deliveredAt
```

#### ADDED: Booking Model Security Requirements Subsection
New subsection documenting field purposes:

- **deliveryOtp:** Stored as bcrypt hash (never plain text)
- **deliveryOtpAttempts:** Counter for failed OTP verification attempts (reset to 0 on success)
- **deliveryOtpLockedUntil:** Timestamp marking automatic 15-minute lockout after 5 failed attempts
- All three fields required for delivery OTP rate limiting and security enforcement

**Reference in PRD:** Lines 1252-1264

---

### 5. **Section 55 — Testing, UAT & Sign-Off**

#### ADDED: Delivery OTP Security Testing (Mandatory)
New mandatory test layer for OTP security:

- Verify delivery OTP hashed (bcrypt) in database, never plain text
- All 5 successful delivery OTP verifications use bcrypt.compare() and complete without errors
- **Failed OTP test:** enter wrong code 5 times → verify booking locked and cannot be verified
- **Lockout message** shows user when booking locked and when they can retry
- **After 15-minute lockout** → booking unlocked and OTP can be re-verified
- Rate limiting works consistently across **both delivery paths:**
  - Driver status update
  - Warehouse scan delivery
- No plain-text OTP in logs, API responses, or error messages
- Audit logs record all OTP attempt failures with timestamp and user identity

**Reference in PRD:** Lines 1362-1370

---

### 6. **Section 57 — Go-Live Exit Criteria**

#### ADDED: Security Sign-Off Requirements (Mandatory)
New mandatory security verification for production launch:

- Delivery OTP security verified: All OTP codes hashed with bcrypt, never plain text in database
- **Delivery OTP rate limiting tested and working:** 5 failed attempts → 15-minute automatic lockout
- No plain-text OTP in logs, API responses, error messages, or backups
- Audit logging records all OTP failures with timestamp and user identity
- Database backup and restore tested; **OTP hashes remain secure after restore**
- **Security penetration testing passed** for OTP brute force attacks (verified 5-attempt limit enforced)
- All OTP security requirements documented and communicated to support team

**Reference in PRD:** Lines 1403-1410

---

## Changes Alignment

| Aspect | Before | After |
|--------|--------|-------|
| **OTP Storage** | "hashed at rest" (vague) | "bcrypt 10 rounds" (specific) |
| **Delivery OTP Rate Limiting** | Not mentioned | Fully documented with specs |
| **Lockout Duration** | N/A | 15 minutes automatic |
| **Lockout Behavior** | N/A | Automatic, non-bypassable |
| **Database Fields** | Not documented | Explicitly defined in Core Data Models |
| **Testing Requirements** | General security | OTP-specific mandatory tests |
| **Go-Live Criteria** | Generic security | OTP-specific security sign-off |

---

## Implementation References

All changes in PRD now map to actual implementation:

| PRD Section | Implementation Location |
|-------------|--------------------------|
| Delivery OTP Security (12) | `backend/src/modules/bookings/bookings.service.ts` |
| Delivery OTP Security (12) | `backend/src/modules/scan/scan.service.ts` |
| Delivery OTP Rate Limiting (3) | `backend/prisma/schema.prisma` (new fields) |
| Security Sign-Off (57) | `DELIVERY_OTP_SECURITY_FIX.md` (verification report) |

---

## Database Schema References

PRD now documents the following database migration:
- **Migration:** `20260506161447_add_delivery_otp_rate_limiting`
- **Fields Added:**
  - `Booking.deliveryOtpAttempts` — Int, default 0
  - `Booking.deliveryOtpLockedUntil` — DateTime, nullable

---

## Compliance Verification

✅ **All security enhancements are now formal PRD requirements:**
- Developers must follow OTP hashing requirements
- QA must test mandatory OTP security test cases
- Ops must verify security sign-off before go-live
- Support team can reference PRD for lockout handling

✅ **PRD is now source of truth for OTP security:**
- No discrepancy between spec and implementation
- Future features must align with documented security model
- Change control required for any OTP security modifications

---

## Sign-Off

**PRD Version:** v10 ULTIMATE (Updated May 6, 2026)  
**Section Updates:** 6 sections updated/expanded  
**New Security Requirements:** Fully integrated  
**Status:** ✅ READY FOR PRODUCTION DEPLOYMENT

