// src/validations/booking.validation.js
//
// Joi schemas for all booking lifecycle endpoints.
// PRD §5   — Portal Architecture (booking flows per role)
// PRD §6   — Order Lifecycle & Status Management
// PRD §7   — Pricing Engine & Financial Model
// PRD §7.2 — Trip Charges
// PRD §7.8 — Negotiation & Bidding Marketplace
// ─────────────────────────────────────────────────────────────────────────────

const Joi   = require('joi');
const { J } = require('../middleware/validate');

const { BOOKING_STATUS, CHARGE_TYPE, OFFER_STATUS, PAYMENT_METHOD } = require('../constants/bookingStatus');

/* ── Vehicle types (PRD §7.12) ─────────────────────────────── */
const VEHICLE_TYPES = [
  'motorcycle',
  'pickup_truck',
  'van',
  'light_truck',
  'heavy_truck',
];

/* ── Cargo types ────────────────────────────────────────────── */
const CARGO_TYPES = [
  'general',
  'fragile',
  'perishable',
  'hazardous',
  'livestock',
  'machinery',
  'electronics',
  'furniture',
  'other',
];

/* ============================================================
   CREATE BOOKING
   POST /api/v1/customer/bookings
   POST /api/v1/agent/bookings
   POST /api/v1/transporter/bookings
   POST /api/v1/admin/bookings
   PRD §5.3 Customer, §5.4 Agent, §5.5 Transporter
   ============================================================ */

const createBookingSchema = Joi.object({

  // ── Addresses ────────────────────────────────────────────
  pickup_address:   Joi.string().min(5).max(500).trim().required(),
  delivery_address: Joi.string().min(5).max(500).trim().required(),

  // Optional coordinates — used for map display & driver proximity
  pickup_lat:       J.latitude.optional(),
  pickup_lng:       J.longitude.optional(),
  delivery_lat:     J.latitude.optional(),
  delivery_lng:     J.longitude.optional(),

  // ── Cargo ────────────────────────────────────────────────
  cargo_type:        Joi.string().valid(...CARGO_TYPES).required(),
  cargo_weight_kg:   Joi.number().positive().max(30000).required(),
  cargo_description: Joi.string().max(1000).trim().optional(),
  special_instructions: Joi.string().max(500).trim().optional(),

  // ── Vehicle ──────────────────────────────────────────────
  vehicle_type: Joi.string().valid(...VEHICLE_TYPES).required(),

  // ── Pricing ──────────────────────────────────────────────
  // Customer rate is set by Admin / pricing engine — optional at creation
  customer_rate: J.money.optional(),
  hire_rate:     J.money.optional(),

  // Payment method — defaults to mpesa
  payment_method: Joi.string()
    .valid(...Object.values(PAYMENT_METHOD))
    .default(PAYMENT_METHOD.MPESA),

  // Advance amount (if partial pre-payment)
  advance_amount: J.money.allow(0).optional(),

  // ── Scheduling ───────────────────────────────────────────
  // If not provided, booking is treated as ASAP
  scheduled_at: Joi.date().iso().min('now').optional(),

  // Multi-stop delivery addresses (PRD §7.13)
  additional_stops: Joi.array()
    .items(Joi.string().min(5).max(500).trim())
    .max(5)
    .optional(),

  // Recurring booking flag (PRD §5.3)
  is_recurring: Joi.boolean().default(false),
  recurrence_pattern: Joi.when('is_recurring', {
    is:   true,
    then: Joi.string().valid('daily', 'weekly', 'monthly').required(),
    otherwise: Joi.forbidden(),
  }),

  // ── Ownership (injected by injectBookingOwnership middleware) ──
  // These are set automatically — schema accepts them to pass validation
  created_by_role: Joi.string().optional(),
  created_by_id:   J.uuid.optional(),
  handled_by:      Joi.string().valid('admin', 'transporter').optional(),
  transporter_id:  J.uuid.allow(null).optional(),

  // Agent booking on behalf of a specific customer
  customer_id: J.uuid.optional(),

  // Contract-based pricing reference (PRD §7.0)
  contract_id: J.uuid.optional(),

  // Offer price — used when customer enters the bidding marketplace
  offer_price: J.money.optional(),
});

/* ============================================================
   UPDATE BOOKING STATUS  (PATCH /api/v1/driver/trips/:id/status)
   PRD §6 — only valid forward transitions allowed
   Enforced further in controller via DRIVER_ALLOWED_TRANSITIONS
   ============================================================ */

const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      BOOKING_STATUS.ACCEPTED,
      BOOKING_STATUS.PICKED_UP,
      BOOKING_STATUS.IN_TRANSIT,
      BOOKING_STATUS.DELIVERED,
    )
    .required(),

  // Required when status = delivered (PRD §14.4 — POD mandatory)
  pod_photo_url: Joi.when('status', {
    is:   BOOKING_STATUS.DELIVERED,
    then: Joi.string().uri().required()
      .messages({ 'any.required': 'Proof of Delivery photo URL is required when marking as Delivered.' }),
    otherwise: Joi.optional(),
  }),

  // Driver's current location at status update (PRD §14.4 — GPS tracking)
  current_lat: J.latitude.optional(),
  current_lng: J.longitude.optional(),

  notes: Joi.string().max(500).trim().optional(),
});

/* ============================================================
   ADMIN ASSIGN DRIVER  (PATCH /api/v1/admin/bookings/:id/assign)
   PRD §4 — Assignment Engine
   ============================================================ */

const assignDriverSchema = Joi.object({
  driver_id:  J.uuid.required(),
  vehicle_id: J.uuid.required(),
  notes:      Joi.string().max(500).trim().optional(),
});

/* ============================================================
   ADMIN STATUS OVERRIDE  (PATCH /api/v1/admin/bookings/:id/status)
   Admin can move booking to ANY status with mandatory reason.
   PRD §3.1 — Admin override authority
   ============================================================ */

const adminStatusOverrideSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(BOOKING_STATUS))
    .required(),

  reason: Joi.string().min(5).max(500).trim().required()
    .messages({ 'any.required': 'A reason is required for Admin status overrides.' }),
});

/* ============================================================
   CANCEL BOOKING  (POST /api/v1/customer/bookings/:id/cancel)
   PRD §6.1 — Cancellation & Penalty Rules
   ============================================================ */

const cancelBookingSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required()
    .messages({ 'any.required': 'Please provide a cancellation reason.' }),
});

/* ============================================================
   RATE BOOKING  (POST /api/v1/customer/bookings/:id/rate)
   PRD §5.3 — 48-hour rating window after completion
   ============================================================ */

const rateBookingSchema = Joi.object({
  driver_rating: Joi.number().integer().min(1).max(5).required(),
  comment:       Joi.string().max(500).trim().optional(),
});

/* ============================================================
   PRICE ESTIMATE QUERY  (GET /api/v1/customer/price-estimate)
   PRD §7 — Pricing Engine
   ============================================================ */

const priceEstimateQuerySchema = Joi.object({
  vehicle_type:    Joi.string().valid(...VEHICLE_TYPES).required(),
  cargo_weight_kg: Joi.number().positive().max(30000).required(),
  distance_km:     Joi.number().positive().required(),
  scheduled_at:    Joi.date().iso().optional(),   // determines night/holiday surcharge
  additional_stops: Joi.number().integer().min(0).max(5).default(0),
});

/* ============================================================
   ADD TRIP CHARGE  (POST /api/v1/trip-charge)
   PRD §7.2 — Trip Charges (toll, fuel, loading, etc.)
   ============================================================ */

const addTripChargeSchema = Joi.object({
  booking_id:  J.uuid.required(),
  charge_type: Joi.string().valid(...Object.values(CHARGE_TYPE)).required(),
  amount:      J.money.required(),
  description: Joi.string().max(500).trim().optional(),
});

/* ============================================================
   SUBMIT BID / OFFER  (POST /api/v1/booking/:id/offers)
   PRD §7.8 — Negotiation & Bidding Marketplace
   ============================================================ */

const submitOfferSchema = Joi.object({
  price:      J.money.required(),
  message:    Joi.string().max(500).trim().optional(),
  expires_at: Joi.date().iso().min('now').optional(),
});

/* ============================================================
   RESPOND TO OFFER  (PATCH /api/v1/booking/:bookingId/offers/:offerId)
   PRD §7.8
   ============================================================ */

const respondToOfferSchema = Joi.object({
  status: Joi.string()
    .valid(OFFER_STATUS.ACCEPTED, OFFER_STATUS.REJECTED, OFFER_STATUS.COUNTERED)
    .required(),

  // Required when countering
  counter_price: Joi.when('status', {
    is:   OFFER_STATUS.COUNTERED,
    then: J.money.required()
      .messages({ 'any.required': 'A counter price is required when responding with a counter-offer.' }),
    otherwise: Joi.forbidden(),
  }),

  message: Joi.string().max(500).trim().optional(),
});

/* ============================================================
   LIST BOOKINGS QUERY  (GET /api/v1/admin/bookings etc.)
   PRD §5.1 — Admin full filtering
   ============================================================ */

const listBookingsQuerySchema = Joi.object({
  status:       Joi.string().valid(...Object.values(BOOKING_STATUS)),
  vehicle_type: Joi.string().valid(...VEHICLE_TYPES),
  driver_id:    J.uuid,
  customer_id:  J.uuid,
  transporter_id: J.uuid,
  handled_by:   Joi.string().valid('admin', 'transporter'),
  date_from:    Joi.date().iso(),
  date_to:      Joi.date().iso().min(Joi.ref('date_from')),
  search:       Joi.string().max(100).trim(),   // booking ref / address
  page:         J.page,
  limit:        J.limit,
});

/* ============================================================
   BOOKING ID PARAM
   ============================================================ */

const bookingParamSchema = Joi.object({
  id: J.uuid.required(),
});

const offerParamSchema = Joi.object({
  bookingId: J.uuid.required(),
  offerId:   J.uuid.required(),
});

module.exports = {
  createBookingSchema,
  updateBookingStatusSchema,
  assignDriverSchema,
  adminStatusOverrideSchema,
  cancelBookingSchema,
  rateBookingSchema,
  priceEstimateQuerySchema,
  addTripChargeSchema,
  submitOfferSchema,
  respondToOfferSchema,
  listBookingsQuerySchema,
  bookingParamSchema,
  offerParamSchema,
};