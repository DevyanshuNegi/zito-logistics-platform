# QA TESTING PROCEDURES - ZITO LAUNCH
**Document:** QA Test Plan & Procedures  
**Date:** May 13, 2026  
**Version:** 1.0  
**Testing Window:** June 1-3, 2026  

---

## INTRODUCTION

This document provides detailed QA testing procedures for ZITO platform before launch. All test cases are mapped to PRD requirements and critical user flows.

**Test Scope:**
- ✅ Mobile apps (Customer, Partner, Admin)
- ✅ Web portal (Frontend)
- ✅ Backend APIs (Core workflows)
- ✅ Payment integration
- ✅ Real-time tracking
- ✅ Branding & UI compliance

**Test Environment:**
- Staging database
- Production-like infrastructure
- Test payment credentials (M-Pesa dev mode)
- Android 8.0+ (minimum)
- iOS 14.0+ (minimum)

---

## SECTION 1: TEST SETUP

### 1.1 Test Device Preparation

**Android Devices (Minimum 2):**
```
Device 1: Pixel 4a (API 28+) - Primary testing
Device 2: Samsung A12 (API 28+) - Device diversity
Settings:
- Clear app cache before each test
- Enable developer options
- Disable sleep timer
- Turn off auto-lock
- Wi-Fi + Cellular network
- Location services enabled
- Camera & photo permissions granted
```

**iOS Devices (Minimum 2, if applicable):**
```
Device 1: iPhone 12 (iOS 14+) - Primary testing
Device 2: iPhone SE (iOS 14+) - Device diversity
Settings:
- Clear app cache before each test
- Developer mode enabled
- Location services on
- Camera & photo permissions granted
```

### 1.2 Test User Accounts

**Customer Test Accounts:**
```
Customer 1 (New User):
- Phone: +256 700 000 001
- Email: customer1@zito.test
- Password: Test@123
- Role: CUSTOMER
- Status: PENDING (first login)

Customer 2 (Repeat User):
- Phone: +256 700 000 002
- Email: customer2@zito.test
- Previous bookings: 5
- Status: VERIFIED

Corporate Account:
- Phone: +256 700 000 003
- Company: Test Corp
- Tax ID: 12345678
- Contact: corporate@zito.test
```

**Partner Test Accounts:**
```
Driver 1:
- Phone: +256 700 100 001
- License: ABC12345
- Vehicle: Motorcycle
- Status: ACTIVE

Driver 2:
- Phone: +256 700 100 002
- License: XYZ67890
- Vehicle: Van
- Status: ACTIVE

Transporter:
- Phone: +256 700 100 003
- Company: Test Transport
- Fleet: 3 vehicles
- Status: ACTIVE
```

**Admin Test Accounts:**
```
Super Admin:
- Email: admin@zito.test
- Password: Admin@123
- Scope: Full platform

Admin (Operations):
- Email: ops@zito.test
- Dept: OPERATIONS
- Scope: Booking management only

Staff (Customer Care):
- Email: support@zito.test
- Dept: CUSTOMER_CARE
- Scope: Support tickets only
```

### 1.3 Payment Testing

**M-Pesa Dev Mode:**
```
Enable dev credentials in .env.staging:
MPESA_ENV=development
MPESA_CONSUMER_KEY=dev_key_xxx
MPESA_CONSUMER_SECRET=dev_secret_xxx

Test STK Push (Customer pays):
- Phone: +256 700 000 001
- Amount: KES 500
- Expected: STK popup after 3-5 seconds
- PIN: 1234 (dev mode auto-accepts)

Test Callback:
- Should receive payment callback
- Database should update with payment_completed status
- Booking should auto-transition to next state
```

---

## SECTION 2: TEST CASES - CUSTOMER APP

### 2.1 Authentication & Login Flow

**Test Case: TC-CUS-001 - New User Phone Login**
```
Preconditions:
- Fresh app install
- Phone: +256 700 000 001

Steps:
1. Tap "Login" button
2. Verify Phone tab is selected (PRIMARY)
3. Enter phone: +256 700 000 001
4. Tap "Continue"

Expected Results:
✓ Receives OTP via SMS to phone
✓ Transitions to OTP verification screen
✓ Can see last 4 digits of phone (security)
✓ 6 OTP input fields displayed
✓ "Resend" button shows 60s countdown

Verification:
□ OTP received within 10 seconds
□ Phone field correctly formatted: +256 7XX XXX XXX1
□ Countdown timer accurate
□ Auto-submit when all 6 digits entered
```

**Test Case: TC-CUS-002 - Email Login (Secondary Option)**
```
Preconditions:
- On login screen

Steps:
1. Tap "Email" tab
2. Enter: customer1@zito.test
3. Enter password: Test@123
4. Tap "Continue"

Expected Results:
✓ Tab switched to Email
✓ Password field appeared
✓ Transitions to home screen

Verification:
□ Email field visible
□ Password field secure (dots)
□ Show/Hide password toggle works
□ Login succeeds with correct credentials
□ Login fails with wrong password
```

**Test Case: TC-CUS-003 - OTP Expiry**
```
Preconditions:
- OTP generated and waiting for input
- Time: T+0 minutes

Steps:
1. Wait 6 minutes without entering OTP
2. Attempt to enter OTP

Expected Results:
✓ OTP fields become disabled
✓ Error message: "OTP expired"
✓ "Resend" button available
✓ Must resend to get new OTP

Verification:
□ Expires exactly at 5 minutes (not before, not after)
□ Error message clear and actionable
□ User can resend without losing session
```

### 2.2 Booking Creation

**Test Case: TC-CUS-010 - Create Courier Booking**
```
Preconditions:
- Logged in as customer1@zito.test
- Location: Nairobi, Kenya
- Network: Wi-Fi

Steps:
1. Tap "Book a delivery" button
2. Select vehicle type: Courier
3. Enter pickup address: "100 Tom Mboya St"
4. Tap on map → location auto-fills
5. Enter delivery address: "Kilimani, Nairobi"
6. Tap continue
7. Verify quoted price: ~KES 500
8. Tap "Continue with payment"

Expected Results:
✓ Vehicle selection screen shows 5 options
✓ Address search responsive (< 1s)
✓ Auto-fill from map works
✓ Price displays immediately (< 500ms)
✓ No hidden fees shown
✓ Breakdown shows: Base + Distance + Surcharge

Verification:
□ Price calculation correct for distance
□ Dynamic pricing applied (time-based if applicable)
□ Address validation catches invalid addresses
□ Map shows pickup & delivery markers
□ Estimated time shows correctly
```

**Test Case: TC-CUS-011 - Create Multi-Stop Booking**
```
Preconditions:
- On booking creation screen

Steps:
1. Add pickup address
2. Tap "+ Add stop"
3. Add stop 1 address
4. Tap "+ Add stop" again
5. Add stop 2 address
6. Tap "+ Add stop" again
7. Add final delivery address
8. Verify price updates for multi-stop

Expected Results:
✓ Can add up to 5 stops total (pickup + 4 stops)
✓ Price recalculates with each addition
✓ Route optimization shown
✓ All stops appear on map
✓ Estimated time for all deliveries

Verification:
□ UI doesn't break with 5 stops
□ Price calculation includes all segments
□ Route is logical (not randomly ordered)
□ Remove stop button works
□ Can reorder stops
```

**Test Case: TC-CUS-012 - Vehicle Type Impact on Price**
```
Preconditions:
- Same pickup/delivery addresses
- Distances: 5km

Steps:
1. Select motorcycle for 5km delivery
2. Note price: ~KES 325
3. Back to vehicle selection
4. Select van for same route
5. Compare price

Expected Results:
✓ Motorcycle: ~KES 325
✓ Van: ~KES 1,500
✓ Truck: ~KES 3,000
✓ Pricing follows PRD (Section 7.12)

Verification:
□ Motorcycle < Van < Truck (cost-wise)
□ Prices within expected ranges
□ Calculations match PRD formulas
□ No unexpected price jumps
```

### 2.3 Payment Flow

**Test Case: TC-CUS-020 - M-Pesa Payment**
```
Preconditions:
- Booking created with KES 500 amount
- Phone: +256 700 000 001

Steps:
1. Tap "Proceed to payment"
2. Select M-Pesa as payment method
3. Tap "Pay with M-Pesa"
4. Wait for STK popup (3-5 seconds)
5. STK appears on device
6. Enter PIN: 1234
7. Confirm payment

Expected Results:
✓ STK appears within 5 seconds
✓ Amount matches booking amount (KES 500)
✓ Phone number is correct
✓ Payment receipt shows in app
✓ Booking transitions to payment_completed
✓ Driver receives notification
✓ Customer receives confirmation SMS

Verification:
□ Payment marked as successful in DB
□ No duplicate charges
□ Transaction appears in booking history
□ Booking state: PAYMENT_COMPLETED
□ Driver can see this booking
```

**Test Case: TC-CUS-021 - Payment Timeout**
```
Preconditions:
- STK popup showing
- Payment pending

Steps:
1. Don't enter PIN for 2 minutes
2. STK times out
3. Return to app

Expected Results:
✓ Error message: "Payment timeout"
✓ Booking remains in PAYMENT_PENDING
✓ Option to retry payment
✓ Amount not charged

Verification:
□ No charge taken on timeout
□ Can retry unlimited times
□ No duplicate payment created
□ Error message is clear
```

### 2.4 Real-Time Tracking

**Test Case: TC-CUS-030 - Live Tracking After Booking**
```
Preconditions:
- Booking in ACCEPTED state
- Driver assigned: Driver 1
- Driver app has location updates enabled

Steps:
1. Tap on active booking
2. Tap "Track delivery" button
3. Observe map showing driver location
4. Wait 10 seconds
5. Observe driver location update

Expected Results:
✓ Map loads with driver icon
✓ Driver location updates every 5-10 seconds
✓ Route shown from driver to delivery address
✓ ETA shows (updates as driver moves)
✓ Can tap on driver icon to see profile
✓ Chat icon available for direct messaging

Verification:
□ Location updates within 5-10 seconds
□ Map tiles load without delay
□ No lag when zooming/panning
□ Accuracy reasonable (within 10m)
□ Connection resilient to network changes
□ Works on Wi-Fi and Cellular
```

### 2.5 Delivery Completion

**Test Case: TC-CUS-040 - Upload Proof of Delivery**
```
Preconditions:
- Booking in IN_TRANSIT state
- Arrived at delivery location
- Driver has taken photo

Steps:
1. Driver taps "Mark delivered"
2. Camera/photo upload screen
3. Either: Take photo or Upload existing
4. Take a photo of mock package
5. Tap "Confirm delivery"
6. Enter delivery OTP: provided by app

Expected Results:
✓ Camera interface works
✓ Photo captures clearly
✓ Photo uploads and displays
✓ OTP field appears
✓ OTP is 6 digits
✓ Booking transitions to COMPLETED
✓ Payment captures if not already captured
✓ Customer notified

Verification:
□ Photo is actually stored (not just UI)
□ Photo quality acceptable
□ OTP matches what system generated
□ No double-payment on completion
□ Booking receipt generated
```

### 2.6 Branding & UI Compliance

**Test Case: TC-CUS-050 - Branding Verification**
```
Preconditions:
- App installed and opened

Steps:
1. Check app header/navigation
2. Look for company branding
3. Check login screen logo
4. Check dashboard header
5. Check all screens for "Aurenza"

Expected Results:
✓ NO "Aurenza Limited" text visible
✓ Clean "ZITO" logo visible
✓ Blue theme (#0066FF) applied consistently
✓ App name shows as "Zito Logistics"
✓ Professional appearance

Verification:
□ Logo is Z icon + text
□ No company name in customer app
□ Colors match brand guidelines
□ Phone login is DEFAULT tab
□ All UI elements properly themed
```

---

## SECTION 3: TEST CASES - PARTNER APP

### 3.1 Partner Login & Setup

**Test Case: TC-PART-001 - Partner Phone Login**
```
Preconditions:
- Fresh app install
- Driver 1 phone: +256 700 100 001

Steps:
1. Tap "Login"
2. Verify Phone tab selected (PRIMARY)
3. Enter: +256 700 100 001
4. Enter OTP
5. Complete profile setup

Expected Results:
✓ Phone login is primary option
✓ OTP flow identical to customer app
✓ Profile completion form appears
✓ Can set availability, service areas
✓ Onboarding completes in < 3 minutes

Verification:
□ Phone login works as primary
□ Profile updates are persisted
□ Availability settings saved
□ Service areas properly configured
```

### 3.2 Job Management

**Test Case: TC-PART-010 - View Available Jobs**
```
Preconditions:
- Logged in as Driver 1
- Location: Nairobi
- 5+ jobs available in area

Steps:
1. Open Jobs tab
2. Observe job list
3. Scroll through jobs
4. Tap on one job to see details

Expected Results:
✓ Jobs sorted by distance (closest first)
✓ Each job shows: Destination | Estimated pay | Distance
✓ Accept button highlighted
✓ Detailed view shows full info
✓ Map preview available

Verification:
□ Job list updates in real-time
□ Can view details without accepting
□ Pricing transparent (base + distance + bonuses)
□ Estimated time to deliver shown
□ Area within driver's service zone
```

**Test Case: TC-PART-011 - Accept Job**
```
Preconditions:
- Viewing job details
- Job: Delivery from Tom Mboya to Kilimani, KES 600

Steps:
1. Tap "Accept" button
2. Observe confirmation
3. Check navigation to next step

Expected Results:
✓ Job immediately assigned to driver
✓ Customer notified (SMS + app notification)
✓ Job moves to "Active" tab
✓ Navigation starts automatically
✓ GPS tracking begins
✓ Timer shows elapsed time

Verification:
□ Acceptance recorded immediately
□ No lag or loading delays
□ Can only accept if online
□ Cannot accept if battery < 10%
□ Customer receives real-time notification
```

### 3.3 Real-Time Tracking (Partner Side)

**Test Case: TC-PART-020 - GPS Tracking During Delivery**
```
Preconditions:
- Job accepted
- Route navigation active
- GPS enabled

Steps:
1. Start delivery (tap "Started")
2. Navigate to delivery address
3. Observe GPS tracking on map
4. Arrive at delivery address

Expected Results:
✓ Map shows current location
✓ Route highlighted
✓ ETA updates as you move
✓ Notifications for turns
✓ Speed indicator shows current speed
✓ Offline indicator if connection lost

Verification:
□ GPS updates every 5-10 seconds
□ Accuracy within 10m
□ Battery drain reasonable
□ Works with network switching
□ Accurate ETA calculations
```

### 3.4 Earnings & Settlement

**Test Case: TC-PART-030 - Earnings Tracker**
```
Preconditions:
- 3+ completed deliveries

Steps:
1. Open Earnings tab
2. Check weekly total
3. Check daily breakdown
4. Tap on individual delivery

Expected Results:
✓ Total earnings: KES 1,800 (3 × KES 600)
✓ Daily breakdown visible
✓ Bonuses applied if applicable
✓ Cancellation penalties shown
✓ Withdrawal history visible

Verification:
□ Math is correct
□ All deliveries accounted for
□ Bonuses (if any) clearly noted
□ No unauthorized deductions
□ Withdrawal status shown
```

**Test Case: TC-PART-031 - Weekly Settlement**
```
Preconditions:
- End of week (Friday)
- Earnings: KES 2,400

Steps:
1. Check settlement notification
2. Verify amount: KES 2,400
3. Confirm settlement request
4. Wait for M-Pesa transfer

Expected Results:
✓ Settlement sent automatically Friday 3 PM
✓ Amount matches weekly earnings
✓ Confirmation SMS received
✓ M-Pesa deposit within 5 minutes
✓ Receipt in app

Verification:
□ Automatic processing (no manual approval needed)
□ Amount is correct
□ Settlement to M-Pesa number on file
□ Within expected timeframe
□ No double settlements
```

---

## SECTION 4: TEST CASES - ADMIN APP

### 4.1 Admin Login

**Test Case: TC-ADMIN-001 - Admin Email Login**
```
Preconditions:
- Admin app installed
- Email: admin@zito.test

Steps:
1. Tap "Login"
2. Verify Email tab selected (not Phone)
3. Enter email: admin@zito.test
4. Enter password: Admin@123
5. Tap "Login"

Expected Results:
✓ Email is primary option for admin
✓ Password field visible
✓ Can log in without OTP
✓ Transitions to admin dashboard
✓ Full permissions visible

Verification:
□ Email login working
□ Password authentication working
□ No OTP step for admin
□ Correct role permissions applied
□ Admin sees all menus
```

### 4.2 Booking Management

**Test Case: TC-ADMIN-010 - View All Bookings**
```
Preconditions:
- Logged in as Super Admin
- 15+ bookings created

Steps:
1. Open Bookings view
2. Observe booking list (card view expected, not table)
3. Filter by status
4. Search by reference

Expected Results:
✓ Card-first layout (not admin-table style)
✓ Live map showing all delivery locations
✓ Quick filters: Pending | In Transit | Completed | Cancelled
✓ Search by booking ID, customer, driver
✓ Live status indicators
✓ Quick action buttons

Verification:
□ Map loads with all bookings
□ Card view is responsive
□ Search is instant (< 500ms)
□ Filters work correctly
□ Can drill into any booking
```

### 4.3 Branding Compliance (Admin)

**Test Case: TC-ADMIN-020 - Company Branding Visible**
```
Preconditions:
- Admin app opened

Steps:
1. Check header/logo
2. Look for company name
3. Check all screens

Expected Results:
✓ Zito Operations app name visible
✓ Company "Aurenza Limited" visible (allowed in admin)
✓ Purple theme (#9C27B0) applied
✓ Professional internal appearance

Verification:
□ Company name shows in admin (different from customer app)
□ Branding is consistent
□ No conflicting brands
□ Admin-specific styling applied
```

---

## SECTION 5: BACKEND API TESTING

### 5.1 Authentication API

**Test Case: TC-API-001 - POST /api/v1/auth/login (Phone)**
```
Endpoint: POST /api/v1/auth/login
Payload:
{
  "phone": "+256700000001",
  "country_code": "UG"
}

Expected Response (201):
{
  "success": true,
  "data": {
    "otp_id": "uuid",
    "phone_masked": "+256 7XX XXX XXX1",
    "expires_at": "2026-06-04T10:05:00Z",
    "send_method": "sms"
  }
}

Verification:
□ Status code 201
□ OTP sent to phone number
□ Response includes masked phone
□ OTP ID can be used for verification
□ Expires in exactly 5 minutes
```

**Test Case: TC-API-002 - POST /api/v1/auth/verify-otp**
```
Endpoint: POST /api/v1/auth/verify-otp
Payload:
{
  "phone": "+256700000001",
  "otp": "123456"
}

Expected Response (200):
{
  "success": true,
  "data": {
    "user": {...},
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600
  }
}

Verification:
□ Status code 200 (correct OTP)
□ Status code 401 (wrong OTP)
□ Access token is valid JWT
□ Can use token for authenticated requests
□ Refresh token works
```

### 5.2 Booking API

**Test Case: TC-API-010 - POST /api/v1/customer/bookings (Create)**
```
Endpoint: POST /api/v1/customer/bookings
Headers:
  Authorization: Bearer {access_token}
Payload:
{
  "stops": [
    { "address": "100 Tom Mboya", "lat": -1.2876, "lng": 36.8172 },
    { "address": "Kilimani", "lat": -1.2963, "lng": 36.7822 }
  ],
  "vehicle_type": "courier",
  "special_instructions": "Handle with care"
}

Expected Response (201):
{
  "success": true,
  "data": {
    "booking_id": "BK-20260604-001",
    "reference": "BK-20260604-001",
    "status": "created",
    "estimated_price": 500,
    "estimated_time": "15 minutes"
  }
}

Verification:
□ Status code 201
□ Booking ID generated
□ Price calculated correctly
□ Distance calculated correctly
□ User is assigned as customer
□ Idempotency: Same request twice = same booking_id
```

**Test Case: TC-API-011 - GET /api/v1/customer/bookings**
```
Endpoint: GET /api/v1/customer/bookings?limit=10&offset=0
Headers:
  Authorization: Bearer {access_token}

Expected Response (200):
{
  "success": true,
  "data": {
    "bookings": [...],
    "total_count": 5,
    "limit": 10,
    "offset": 0
  }
}

Verification:
□ Status code 200
□ Returns paginated results
□ Only customer's own bookings returned
□ Sorting by created_at DESC
□ Can filter by status, date range
```

### 5.3 Payment API

**Test Case: TC-API-020 - POST /api/v1/payments/initiate**
```
Endpoint: POST /api/v1/payments/initiate
Payload:
{
  "booking_id": "BK-20260604-001",
  "amount": 500,
  "currency": "KES",
  "payment_method": "mpesa"
}

Expected Response (201):
{
  "success": true,
  "data": {
    "payment_id": "PAY-123",
    "amount": 500,
    "status": "pending",
    "payment_url": null (M-Pesa uses STK)
  }
}

Verification:
□ Status code 201
□ Payment created in pending state
□ STK sent to M-Pesa
□ Payment ID returned
□ Can track payment status
```

**Test Case: TC-API-021 - Webhook /payments/callback (M-Pesa)**
```
Endpoint: POST /api/v1/payments/callback (webhook from M-Pesa)
Payload from M-Pesa:
{
  "TransactionCode": "LB12345678",
  "Status": "Success",
  "Amount": 500,
  "PhoneNumber": "0700000001"
}

Expected:
✓ Payment marked as completed in DB
✓ Booking transitions to PAYMENT_COMPLETED
✓ Driver notified
✓ Customer notified
✓ Idempotent: Same callback twice = no duplicate charge

Verification:
□ Payment status updates correctly
□ Booking state changes correctly
□ Notifications sent
□ No duplicate payments
□ Timestamps are accurate
```

### 5.4 Real-Time Tracking API

**Test Case: TC-API-030 - GET /api/v1/tracking/booking/:id**
```
Endpoint: GET /api/v1/tracking/booking/BK-20260604-001
Headers:
  Authorization: Bearer {customer_token}

Expected Response (200):
{
  "success": true,
  "data": {
    "booking_id": "BK-20260604-001",
    "driver_id": "DR-001",
    "driver_name": "John",
    "driver_phone": "+256700100001",
    "driver_location": { "lat": -1.2876, "lng": 36.8172 },
    "current_stop": 1,
    "delivery_eta": "15 minutes",
    "route": [...],
    "status": "in_transit"
  }
}

Verification:
□ Status code 200
□ Driver location is real-time (updated within 10s)
□ ETA is calculated correctly
□ Only applicable if booking assigned
□ Customer cannot access other bookings' tracking
□ Works for multiple concurrent bookings
```

---

## SECTION 6: PERFORMANCE TESTING

### 6.1 Load Testing

**Test Case: TC-PERF-001 - API Response Under Load**
```
Scenario: 100 concurrent users accessing bookings

Tool: Apache JMeter
Config:
- 100 threads
- Ramp-up: 10 seconds
- Duration: 5 minutes

Expected Results:
✓ Response time p95 < 500ms
✓ Response time p99 < 1000ms
✓ No errors (0% error rate)
✓ Server CPU < 70%
✓ Memory usage < 80%
✓ Database connections < pool size

Verification:
□ Latency within acceptable bounds
□ No request timeouts
□ Error logs are clean
□ Database queries optimized
□ Connection pool not exhausted
```

### 6.2 Mobile App Performance

**Test Case: TC-PERF-010 - App Launch Time**
```
Device: Android Pixel 4a
Measurement: First screen visible to user

Steps:
1. Force stop app
2. Clear app cache
3. Tap app icon
4. Measure time to home screen

Expected Results:
✓ Cold launch < 3 seconds
✓ Warm launch < 1 second
✓ No splash screen hang
✓ All UI elements rendered

Verification:
□ Time is consistent across 5 launches
□ No console errors
□ No ANRs (Application Not Responding)
□ Smooth animation during launch
```

**Test Case: TC-PERF-011 - Map Rendering**
```
Steps:
1. Open tracking screen (shows map)
2. Measure time to map tiles loaded
3. Measure smooth scrolling

Expected Results:
✓ Map visible within 2 seconds
✓ All tiles loaded within 3 seconds
✓ Pan/zoom is smooth (60fps)
✓ No memory leak after repeated load

Verification:
□ Map renders consistently
□ No jank or stuttering
□ Markers appear promptly
□ Offline fallback works
```

---

## SECTION 7: SECURITY TESTING

### 7.1 Authentication Security

**Test Case: TC-SEC-001 - OTP Rate Limiting**
```
Steps:
1. Generate OTP for phone +256700000001
2. Attempt 10+ wrong OTPs in 1 minute
3. Observe account lockout

Expected Results:
✓ After 5 wrong attempts → Account locked for 15 minutes
✓ User notified of lockout
✓ Support can unlock manually
✓ Correct OTP still fails during lockout

Verification:
□ Rate limiting enforced
□ Lockout duration is 15 minutes
□ Reset after timeout
□ Cannot bypass with different endpoints
```

**Test Case: TC-SEC-002 - Token Expiration**
```
Steps:
1. Get access token
2. Wait 1 hour (token expires at 3600 seconds)
3. Attempt to use expired token

Expected Results:
✓ API returns 401 Unauthorized
✓ Refresh token can still be used
✓ After refresh token expires (7 days) → Must re-login

Verification:
□ Tokens expire at correct time
□ Cannot use expired tokens
□ Refresh process works
□ No security compromise with expired token
```

### 7.2 Data Privacy

**Test Case: TC-SEC-010 - PII Protection**
```
Steps:
1. Capture API response with user data
2. Check logs for sensitive data
3. Check database backups for encryption

Expected Results:
✓ Passwords never logged
✓ Tokens never logged
✓ Phone numbers masked in logs
✓ Payment details encrypted in database
✓ PII fields have encryption at rest

Verification:
□ Logs are clean (no sensitive data)
□ Database encryption active
□ Backups encrypted
□ GDPR compliance verified
```

---

## SECTION 8: TEST EXECUTION & REPORTING

### 8.1 Test Execution Schedule

**June 1, 2026 (Friday):**
- 9:00 AM: Test environment setup
- 10:00 AM: Smoke tests (basic functionality)
- 12:00 PM: Functional testing begins

**June 2, 2026 (Saturday):**
- 9:00 AM: Continue functional testing
- 1:00 PM: Performance testing
- 4:00 PM: Security testing

**June 3, 2026 (Sunday):**
- 9:00 AM: Bug fix verification
- 11:00 AM: Regression testing
- 2:00 PM: Final QA sign-off

### 8.2 Bug Severity Matrix

| Severity | Definition | Fix Before Launch | Examples |
|----------|-----------|-------------------|----------|
| P0 | Critical | MUST | App crashes, Payment fails, Data loss |
| P1 | High | MUST | Core flow broken, Login broken | 
| P2 | Medium | SHOULD | UI glitch, Performance issue |
| P3 | Low | CAN DEFER | Typo, Minor cosmetic issue |

### 8.3 Bug Report Template

```
Bug ID: BUG-001
Title: [Concise description]
Severity: P0/P1/P2/P3
Status: OPEN/IN-PROGRESS/FIXED/CLOSED

Device: Pixel 4a | Android 12
App Version: 1.0.0
Date Found: June 1, 2026

Steps to Reproduce:
1. ...
2. ...
3. ...

Expected Result:
...

Actual Result:
...

Evidence:
[Screenshot / Video]

Assigned To: [Developer]
Verification By: [QA]
```

### 8.4 Sign-Off

```
QA TESTING SIGN-OFF

Test Execution Dates: June 1-3, 2026
Total Test Cases: 50+
Passed: ___
Failed: ___
Blocked: ___

Critical Issues: ___ (All must be fixed)
High Priority Issues: ___ (All must be fixed)
Medium Priority Issues: ___ (Can defer if necessary)

QA Lead Signature: _________________ Date: _______
Product Manager Approval: __________ Date: _______
CTO Approval: _____________________ Date: _______

☐ APPROVED FOR LAUNCH
☐ APPROVED WITH CONDITIONS
☐ NOT APPROVED (Requires fixes)
```

---

**Document prepared:** May 13, 2026  
**Ready for execution:** June 1, 2026
