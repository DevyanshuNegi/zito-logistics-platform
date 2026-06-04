# ZITO Stage 1: Operational Focus & Execution Framework
## Building Real Logistics Operations (NOT Just An App)

**Document Type:** Operational Execution Strategy  
**Date:** May 28, 2026  
**Focus:** What to build THIS MONTH to prove operational model  
**Audience:** Engineering, Product, Operations

---

## Core Philosophy: Asset-Light, Operations-Heavy

### What We Control (ZITO)
- Customer acquisition
- Operations management
- Pricing algorithms
- Support + customer service
- Technology platform

### What Partners Control (Transport Companies)
- Trucks + vehicles
- Drivers
- Fuel + maintenance
- Insurance

**Why This Model:**
- ✅ Reduces fuel risk (partner bears it)
- ✅ Reduces maintenance burden (partner handles)
- ✅ Eliminates insurance complexity (partner insures)
- ✅ Capital-light (no fleet to buy)
- ✅ Scalable (add partners, not assets)

---

## Stage 1 Success Criteria (NOT What You Think)

### ❌ What Investors DON'T Care About (Yet)
- Fancy UI / animations / colors
- 100 features
- Advanced AI models
- Blockchain / crypto
- Drones / robotics
- Warehouse automation

### ✅ What Investors REALLY Care About
- Repeat customers (not one-off bookings)
- Operational efficiency (cost per delivery)
- Scalability (grow without adding capital)
- Margins (unit economics work)
- Data (logistics insights)
- Network effects (platform gets stronger with scale)

### 🎯 Stage 1 Success Metrics
1. **Operational:**
   - 95%+ booking-to-delivery success rate
   - < 5% cancellation rate
   - On-time delivery > 90%
   - Driver daily active rate > 60%

2. **Financial:**
   - Positive unit economics (revenue > cost per trip)
   - Customer repeat rate > 50%
   - Driver retention > 80%
   - Operating margin > 10%

3. **Data:**
   - 10,000+ completed deliveries
   - 1,000+ unique customers
   - 500+ active drivers
   - All trips tracked + documented

---

## Perfect First Target Market (NOT Everyone)

### ❌ Do NOT Start With
- Individual online shoppers (courier model)
- Small parcel shippers (race-to-bottom pricing)
- Food delivery (saturated, low margins)
- Casual users (low lifetime value)

### ✅ DO Start With (Recurring Revenue Customers)
- **Distributors** (regular regional shipments)
- **Wholesalers** (bulk goods movement)
- **Factories** (raw material + finished goods)
- **Construction suppliers** (equipment + materials)
- **Importers** (port to warehouse routes)
- **Supermarkets** (supply chain)
- **Pharmacies** (medical distribution)
- **FMCG suppliers** (volume players)

**Why These Customers:**
- Recurring loads (not one-time)
- Predictable routes (optimizable)
- Higher margins (willing to pay for reliability)
- Data-rich (we learn their patterns)
- Long contracts (stable revenue)

---

## Core Operational Flow (Must Work Perfectly)

### The 8-Step Loop

```
1. CUSTOMER CREATES LOAD
   ├─ Pickup location
   ├─ Delivery location
   ├─ Cargo type + weight
   ├─ Preferred timing
   └─ Special instructions

2. SYSTEM CALCULATES
   ├─ Distance (via Google Maps)
   ├─ Estimated fuel cost
   ├─ Vehicle type required (20ft, 40ft, truck, etc.)
   ├─ Base fare + fuel + surcharge
   └─ Dynamic pricing (demand, time, season)

3. ASSIGNMENT (Admin or Auto)
   ├─ Best available transporter (capacity + location)
   ├─ Best available driver (rating + location + vehicle)
   ├─ Optimal route (if multi-stop)
   └─ ETA calculation

4. DRIVER RECEIVES TRIP
   ├─ Push notification + SMS
   ├─ Trip details (pickup, delivery, cargo, pay)
   ├─ Route (GPS navigation)
   ├─ Accept/reject 30 seconds to respond

5. LIVE TRACKING
   ├─ Customer sees real-time GPS
   ├─ ETA updates (traffic-aware)
   ├─ Driver arrival notifications
   ├─ Delivery window (15-min buffer)

6. PROOF OF DELIVERY (POD)
   ├─ Photo of cargo (required)
   ├─ Customer signature OR OTP
   ├─ Delivery timestamp
   ├─ GPS location confirmation

7. INVOICE GENERATED (Automatic)
   ├─ Trip details
   ├─ Cargo description
   ├─ Distance traveled (vs. estimated)
   ├─ Actual fuel used
   ├─ Final charges
   ├─ Customer approval

8. SETTLEMENT & COMMISSIONS
   ├─ Customer invoice (payment terms)
   ├─ Driver payout (wallet or M-Pesa)
   ├─ Transporter commission
   ├─ ZITO revenue
   ├─ Audit trail (every transaction)
   └─ Financial reconciliation

```

**This loop is your business.** If this works 95% of the time, you win.

---

## Database Design: Enterprise Architecture (From Day 1)

### Critical Tables (Already Built or Need Building)

#### USERS Table
```sql
id, phone, email, role, name, status, verified_at, kycDocuments[]
-- Roles: CUSTOMER, DRIVER, TRANSPORTER, ADMIN, AGENT
```

#### DRIVERS Table
```sql
id, userId, licenseNumber, licenseExpiry, rating, tripCount, 
dailyEarnings, walletBalance, status, assignedVehicleId, currentLocation
```

#### VEHICLES Table
```sql
id, plate, type, capacity_kg, capacity_m3, insurance_expiry, 
gps_device_id, owner_transporterId, maintenance_schedule, fuel_card
```

#### BOOKINGS Table ✅ EXISTING
```sql
id, customerId, cargo_type, weight_kg, pickup_location, 
delivery_location, estimated_distance, status, created_at
```

#### TRIPS Table 📌 MUST BUILD THIS MONTH
```sql
id, bookingId, driverId, vehicleId, transporter_id, 
assigned_at, pickup_eta, delivery_eta, actual_pickup_time, 
actual_delivery_time, route_optimized, fuel_estimate, 
actual_fuel, status, tracking_points[]
```

#### PAYMENTS Table 📌 MUST BUILD THIS MONTH
```sql
id, tripId, customerId, driverId, transporterId, 
base_fare, fuel_surcharge, toll_cost, total_amount, 
commission_zito, commission_transporter, payment_method, 
status, settled_at, invoice_id
```

#### COMMISSIONS Table 📌 MUST BUILD THIS MONTH
```sql
id, transporterId, trip_count, revenue_generated, 
commission_rate, commission_amount, settlement_date, 
payment_status
```

#### AGENTS Table 📌 ENHANCED THIS MONTH
```sql
id, userId, region, loads_sourced, commission_rate, 
total_commission, recruiter_id (if sub-agent), status
```

#### DOCUMENTS Table
```sql
id, type, owner_id, owner_type, url, verified_by, 
verified_at, expiry_date, status
-- Types: DRIVER_LICENSE, POD, INVOICE, INSURANCE, PERMIT
```

#### NOTIFICATIONS Table ✅ EXISTING
```sql
id, userId, type, title, body, link, read_at, created_at
```

**Key Design Principles:**
- ✅ Immutable audit trail (never delete, only soft-delete)
- ✅ All timestamps in UTC
- ✅ All amounts in cents (avoid float)
- ✅ Status enums (enforce business rules)
- ✅ Indexes on frequently queried fields
- ✅ Reconciliation fields (calculated vs. actual)

---

## What To Build THIS MONTH (May 28 - June 30)

### 🔴 CRITICAL PATH (Must Do)

#### Backend: Core Trip Lifecycle
**File:** `backend/src/modules/trips/`
- [ ] `trips.module.ts` - Module definition
- [ ] `trips.service.ts` - Trip CRUD + assignment logic
- [ ] `trips.controller.ts` - Endpoints (list, create, update)
- [ ] `trip.entity.ts` - TypeORM entity
- [ ] `trip.dto.ts` - Request/response types

**Key Endpoints:**
- `POST /trips` - Create trip from booking
- `GET /trips/:id` - Get trip details
- `PATCH /trips/:id/status` - Update status (assigned, en_route, arrived, completed)
- `POST /trips/:id/track` - Record GPS tracking point
- `POST /trips/:id/pod` - Submit proof of delivery

#### Backend: Driver Assignment Algorithm
**File:** `backend/src/modules/trips/`
- [ ] `driver-assignment.service.ts` - Smart assignment logic
- [ ] Assignment criteria:
  - Nearest driver (location)
  - Highest rating (> 4.5 stars)
  - Available capacity (vs. cargo weight)
  - Vehicle type match
  - Preferred hours (if driver set preferences)

#### Backend: Dispatcher Dashboard API
**File:** `backend/src/modules/admin/dispatcher/`
- [ ] List all open trips (filtering, sorting)
- [ ] List assignments (pending, confirmed, completed)
- [ ] Reassign trip to different driver
- [ ] See live map of all active trips + drivers
- [ ] Quick stats (on-time %, active drivers, etc.)

#### Backend: RBAC (Role-Based Access Control)
**File:** `backend/src/common/guards/rbac.guard.ts`
- [ ] Restrict endpoints by role (ADMIN, DRIVER, CUSTOMER, TRANSPORTER, AGENT)
- [ ] Verify ownership (driver can only see own trips)
- [ ] Audit logging (who accessed what, when)

#### Frontend: Dispatcher Dashboard
**File:** `frontend/src/pages/dispatcher/`
- [ ] List all open trips (cards with key info)
- [ ] Real-time map with all active trips + drivers
- [ ] Click trip → see details + options (reassign, cancel)
- [ ] Quick assign panel (select driver from list)
- [ ] Stats widget (on-time %, active drivers, revenue)

#### Frontend: Booking → Trip Timeline
**File:** `frontend/src/components/BookingTimeline/`
- [ ] Show booking state (created → assigned → pickup → delivery)
- [ ] Live ETA updates
- [ ] Driver details (name, rating, vehicle)
- [ ] Tracking map (live GPS)
- [ ] Notifications (pickup time, delivery time)

#### Frontend: Invoice Generation & Display
**File:** `frontend/src/components/InvoiceDisplay/`
- [ ] Show invoice on delivery complete
- [ ] Download as PDF
- [ ] Email to customer (if email on file)
- [ ] Payment status (paid, pending, overdue)

#### Mobile: Trip Accept/Reject
**File:** `zito-mobile/src/screens/Trip/`
- [ ] Show incoming trip (30-sec timer)
- [ ] Accept button → trip locked to driver
- [ ] Reject button → reassign to next driver
- [ ] Trip details (pickup, delivery, pay, cargo)

#### Mobile: GPS Tracking
**File:** `zito-mobile/src/services/GpsTracking.ts`
- [ ] Start tracking when trip accepted
- [ ] Send location every 10 seconds
- [ ] Stop tracking on delivery complete
- [ ] Battery optimization (use native location service)

#### Mobile: POD Upload
**File:** `zito-mobile/src/screens/Delivery/`
- [ ] Take photo of cargo
- [ ] Capture customer signature (finger on screen)
- [ ] GPS location confirmation
- [ ] Submit → trip marked complete

#### Mobile: Earnings Page
**File:** `zito-mobile/src/screens/Earnings/`
- [ ] Today's earnings
- [ ] Weekly/monthly breakdown
- [ ] Trip history (list with earnings)
- [ ] Pending payouts
- [ ] Withdrawal (to M-Pesa wallet)

### 🟡 IMPORTANT (Should Do)

#### Backend: Notifications (Enhanced)
- [ ] Trip assigned notification (push + SMS)
- [ ] Pickup time alert (SMS 15 mins before)
- [ ] Delivery on way (SMS with tracking link)
- [ ] Delivery complete (customer receipt)
- [ ] Payment processed (driver + customer)

#### Backend: Invoice Generation
**File:** `backend/src/modules/invoicing/`
- [ ] Generate invoice on trip complete
- [ ] Include: trip details, cargo, distance, fare breakdown
- [ ] Customer approval flow (if needed)
- [ ] Email to customer
- [ ] PDF download

#### Backend: Payment Settlement
**File:** `backend/src/modules/payments/settlement/`
- [ ] Calculate driver payout (trip fee - commission)
- [ ] Record in ledger (audit trail)
- [ ] Queue payout (batch daily or instant M-Pesa)
- [ ] Confirm receipt

#### Frontend: Live Map Component
**File:** `frontend/src/components/LiveMap/`
- [ ] Show all active trips on map
- [ ] Color coding (assigned, pickup, en_route, delivery)
- [ ] Click marker → trip details panel
- [ ] Zoom to trip location

#### Backend: Logging & Monitoring
- [ ] Structured JSON logs (Logtail or similar)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (New Relic or similar)

### 🟢 NICE TO HAVE (After June 30)

- [ ] Advanced analytics dashboard
- [ ] Fuel efficiency tracking
- [ ] Driver performance scoring
- [ ] Route optimization (AI)
- [ ] Predictive demand
- [ ] WhatsApp integration
- [ ] Voice booking

---

## Database Migrations This Month

### New Prisma Models (Add to schema.prisma)

```prisma
// Trip Lifecycle
model Trip {
  id                String    @id @default(uuid())
  bookingId         String    @unique
  booking           Booking   @relation(fields: [bookingId], references: [id])
  
  driverId          String
  driver            Driver    @relation(fields: [driverId], references: [id])
  
  vehicleId         String
  vehicle           Vehicle   @relation(fields: [vehicleId], references: [id])
  
  transporterId     String
  transporter       User      @relation(fields: [transporterId], references: [id])
  
  status            TripStatus @default(ASSIGNED) // ASSIGNED, ACCEPTED, EN_ROUTE, ARRIVED, COMPLETED, CANCELLED
  
  assignedAt        DateTime  @default(now())
  acceptedAt        DateTime?
  pickupETA         DateTime?
  pickupActual      DateTime?
  deliveryETA       DateTime?
  deliveryActual    DateTime?
  
  fuelEstimate      Float?
  fuelActual        Float?
  
  trackingPoints    TrackingPoint[]
  podSubmission     ProofOfDelivery?
  invoice           Invoice?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([driverId, status])
  @@index([transporterId])
  @@index([deliveryActual])
}

model TrackingPoint {
  id        String    @id @default(uuid())
  tripId    String
  trip      Trip      @relation(fields: [tripId], references: [id])
  
  latitude  Float
  longitude Float
  accuracy  Float?
  speed     Float?
  heading   Float?
  
  recordedAt DateTime @default(now())
  
  @@index([tripId, recordedAt])
}

model ProofOfDelivery {
  id            String    @id @default(uuid())
  tripId        String    @unique
  trip          Trip      @relation(fields: [tripId], references: [id])
  
  photoUrl      String
  photoUrl2     String?   // Multiple photos
  
  signatureUrl  String?   // Customer signature
  otp           String?   // Or OTP instead of signature
  
  latitude      Float
  longitude     Float
  
  submittedAt   DateTime  @default(now())
  verifiedAt    DateTime?
  verifiedBy    String?
  
  @@index([tripId])
}

model Invoice {
  id              String    @id @default(uuid())
  tripId          String    @unique
  trip            Trip      @relation(fields: [tripId], references: [id])
  
  customerId      String
  customer        User      @relation(fields: [customerId], references: [id])
  
  invoiceNumber   String    @unique
  invoiceDate     DateTime  @default(now())
  dueDate         DateTime  // Net 14 or Net 30
  
  baseFare        Int       // In cents
  fuelSurcharge   Int
  tollCost        Int
  totalAmount     Int
  
  commissionZito        Int  // In cents
  commissionTransporter Int
  
  status          InvoiceStatus @default(ISSUED) // ISSUED, PAID, OVERDUE, CANCELLED
  paidAt          DateTime?
  paymentMethod   String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([customerId, status])
  @@index([dueDate])
}

model TripStatus {
  ASSIGNED
  ACCEPTED
  EN_ROUTE
  ARRIVED
  COMPLETED
  CANCELLED
  FAILED
}

model InvoiceStatus {
  ISSUED
  PAID
  OVERDUE
  CANCELLED
  REFUNDED
}
```

---

## Strict Build Order (MUST Follow)

### ❌ WRONG ORDER (Will fail)
1. Build AI
2. Build marketplace
3. Build fintech
4. Build advanced analytics
5. Then fix operations

### ✅ CORRECT ORDER (Will work)

**1. Logistics Operations (Weeks 1-4)**
   - Trip lifecycle ✅ (build in Week 2)
   - Driver assignment ✅ (Week 2)
   - Live tracking ✅ (Week 3)
   - POD + invoices ✅ (Week 3-4)

**2. Marketplace (Weeks 5-8)**
   - Transporter onboarding (later phase)
   - Load board (bidding system)
   - Rating + reputation

**3. Automation (Weeks 9-12)**
   - Smart dispatch (optimize driver selection)
   - Route optimization (multi-stop planning)
   - SLA monitoring (alerts on delays)

**4. Fintech (Weeks 13-16)**
   - Wallet enhancements
   - Credit system (postpaid)
   - Escrow payments

**5. AI Intelligence (Weeks 17+)**
   - Demand prediction
   - Pricing optimization
   - Fraud detection
   - Voice assistant

**6. Regional Expansion (Months 12+)**
   - Once Nairobi proven
   - Expand to Mombasa, Kisumu, etc.

---

## What NOT To Build This Month

### ❌ STOP
- Blockchain / crypto (waste of time initially)
- Drone delivery (not viable in Kenya yet)
- Warehouse robotics (out of scope)
- Advanced AI models (not needed yet)
- Cryptocurrency wallets (use M-Pesa)
- Super-complex analytics (keep it simple)
- Marketplace bidding (Phase 2)
- Subscription tiers (already done for Phase 1)
- Multi-language AI voice (later)

### ⏸️ DEFER
- Advanced route optimization (basic routing OK for now)
- Fuel efficiency ML models (collect data first, model later)
- Predictive maintenance (not MVP)
- WhatsApp integration (Phase 2)
- Voice booking (Phase 2)

---

## Success Definition (End of June)

### Operations Working
- ✅ 100+ daily bookings
- ✅ 95%+ on-time delivery
- ✅ < 5% cancellation
- ✅ All POD captured
- ✅ All invoices generated

### Technology Stable
- ✅ Zero payment failures (100% success rate)
- ✅ SMS delivery > 98%
- ✅ App uptime > 99.5%
- ✅ Driver daily active rate > 60%

### Data Collected
- ✅ 5,000+ completed trips
- ✅ All tracked with GPS points
- ✅ All have POD + invoice
- ✅ Financial ledger balanced

### Business Model Proven
- ✅ Unit economics positive (revenue > cost)
- ✅ Repeat customers > 50%
- ✅ Driver retention > 80%
- ✅ Ready to scale

---

## Positioning & Messaging (Critical)

### ❌ DO NOT Say
- "We're a delivery app"
- "Uber for logistics"
- "Courier service"
- "Shipping platform"

### ✅ DO Say
- **"Technology-enabled logistics infrastructure platform"**
- "We connect businesses with transport capacity efficiently"
- "Logistics operating system"
- "Supply chain optimization platform"

### To Customers
"We solve your transportation problem reliably. Book, track, settle—all in one place. Recurring, predictable, efficient."

### To Investors
"We're building the infrastructure layer for East Africa's fragmented logistics. Capital-light, commission-based, network effects. Focus on operations first, then scale via marketplace."

### To Partners
"ZITO handles customer acquisition, pricing, support, tech. You focus on execution. We both win from efficiency."

---

## KPIs to Track Daily

### Operational
- Bookings created
- Bookings completed
- Completion rate %
- On-time delivery %
- Cancellation rate %
- Average trip time

### Financial
- Revenue (trips × avg fare)
- Driver earnings (total payouts)
- Platform commission (revenue - payouts)
- Cost per trip (operationally)

### User
- Active drivers (daily)
- Active customers (daily)
- Driver retention (weekly)
- Customer repeat rate

### Quality
- POD submission rate
- Invoice generation rate
- Payment success rate
- Support tickets (per 100 trips)

---

## Investor Pitch (Revised for Stage 1)

**"We're not building an app. We're building the operating system for East Africa's trillion-dollar supply chain.**

**Stage 1 (now):** Prove that technology-enabled logistics works. Asset-light model. Focus on operational excellence.

**Stage 2 (6 months):** Expand to transporter marketplace. Network effects kick in.

**Stage 3 (12 months):** Regional expansion (East Africa). Fintech + AI layers. Defensible moat.

**Our advantage:** Operational expertise + AI costing engine + agent network. We're not competing on speed; we're competing on efficiency and reliability.

**Traction so far:** [Nairobi operations proven. XXX customers. XXX drivers. XXX daily trips.]

**Target:** KES 400M+/month by Month 18. Multi-billion market. Winner-take-most dynamics."

---

## Document Control

**Version:** 1.0  
**Date:** May 28, 2026  
**Next Update:** June 30, 2026 (End of Stage 1 execution)  
**Related Docs:**
- `ZITO_5_PHASE_PRODUCT_ROADMAP.md` (Strategic vision)
- `PHASE_1_IMPLEMENTATION_TRACKER.md` (Revenue streams)

---

**END OF STAGE 1 OPERATIONAL FRAMEWORK**
