// src/validations/driver.validation.js
//
// Joi schemas for driver registration, compliance, vehicle,
// availability, location, and earnings endpoints.
// PRD §3.5  — Driver Role & Capabilities
// PRD §14   — Compliance & KYC Framework
// PRD §14.1 — Driver Compliance Requirements
// PRD §14.2 — Vehicle Compliance Requirements
// PRD §17   — System Enforcement Rules (assignment validation)
// ─────────────────────────────────────────────────────────────────────────────

const Joi   = require('joi');
const { J } = require('../middleware/validate');

/* ── License classes (Kenya NTSA) ───────────────────────────── */
const LICENSE_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/* ── Vehicle types (PRD §7.12) ─────────────────────────────── */
const VEHICLE_TYPES = [
  'motorcycle',
  'pickup_truck',
  'van',
  'light_truck',
  'heavy_truck',
];

/* ── Ownership types ────────────────────────────────────────── */
const OWNERSHIP_TYPES = ['own', 'company', 'leased'];

/* ============================================================
   DRIVER REGISTRATION / PROFILE
   POST /api/v1/auth/register  (role = driver)
   PUT  /api/v1/driver/profile
   PRD §3.5, §14.1
   ============================================================ */

const driverProfileSchema = Joi.object({

  // ── Personal identity (PRD §14.1 — Identity) ─────────────
  full_name:     Joi.string().min(2).max(100).trim().required(),
  email:         Joi.string().email({ tlds: { allow: false } }).lowercase().trim().required(),
  phone:         J.phone.required(),
  id_number:     Joi.string().min(6).max(20).trim().required()
    .messages({ 'any.required': 'National ID / Passport / Alien ID number is required.' }),
  date_of_birth: Joi.date().iso().max('now').optional(),

  // ── Driving licence (PRD §14.1 — Legal) ──────────────────
  license_number: Joi.string().min(3).max(30).trim().uppercase().required(),
  license_class:  Joi.string().valid(...LICENSE_CLASSES).required(),
  license_expiry: Joi.date().iso().min('now').required()
    .messages({ 'date.min': 'Driving licence must not be expired.' }),

  // ── KRA PIN (PRD §14.1 — Mandatory) ─────────────────────
  kra_pin: Joi.string()
    .pattern(/^[A-Z]\d{9}[A-Z]$/)
    .uppercase()
    .required()
    .messages({ 'string.pattern.base': 'KRA PIN must be in the format A123456789Z.' }),

  // ── Emergency contact ─────────────────────────────────────
  emergency_contact_name:  Joi.string().max(100).trim().optional(),
  emergency_contact_phone: J.phone.optional(),

  // ── Current location (optional at registration) ───────────
  current_lat: J.latitude.optional(),
  current_lng: J.longitude.optional(),

  // ── Transporter link (if driver belongs to a fleet) ───────
  transporter_id: J.uuid.optional(),
});

/* ============================================================
   DRIVER COMPLIANCE DOCUMENTS UPLOAD
   POST /api/v1/driver/compliance
   PRD §14.1 — all document URLs are stored after file upload
   ============================================================ */

const driverComplianceSchema = Joi.object({

  // Document URLs — returned after uploading to storage (S3 / Cloudinary etc.)
  license_doc_url:           Joi.string().uri().optional(),
  kra_pin_doc_url:           Joi.string().uri().optional(),
  police_clearance_url:      Joi.string().uri().optional(),
  police_clearance_expiry:   Joi.date().iso().optional(),
  medical_cert_url:          Joi.string().uri().optional(),
  medical_cert_expiry:       Joi.date().iso().optional(),
  national_id_front_url:     Joi.string().uri().optional(),
  national_id_back_url:      Joi.string().uri().optional(),

  // Digital agreement acceptance (PRD §14.1 — Agreements)
  contract_signed:           Joi.boolean().valid(true).optional()
    .messages({ 'any.only': 'You must accept the driver contract.' }),
  oath_signed:               Joi.boolean().valid(true).optional()
    .messages({ 'any.only': 'You must accept the driver oath.' }),
  sop_signed:                Joi.boolean().valid(true).optional()
    .messages({ 'any.only': 'You must accept the standard operating procedures.' }),

}).min(1).messages({ 'object.min': 'At least one compliance document or agreement must be provided.' });

/* ============================================================
   ADMIN — APPROVE DRIVER
   PATCH /api/v1/admin/drivers/:id/approve
   PRD §3.2 — Operations Admin approval
   ============================================================ */

const approveDriverSchema = Joi.object({
  notes: Joi.string().max(500).trim().optional(),
  // Admin can set verified flags individually
  license_verified:            Joi.boolean().optional(),
  kra_pin_verified:            Joi.boolean().optional(),
  police_clearance_verified:   Joi.boolean().optional(),
  medical_verified:            Joi.boolean().optional(),
});

/* ============================================================
   ADMIN — REJECT DRIVER
   PATCH /api/v1/admin/drivers/:id/reject
   ============================================================ */

const rejectDriverSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required()
    .messages({ 'any.required': 'A rejection reason is required.' }),

  // Specific documents that need resubmission (PRD §14.3)
  resubmission_fields: Joi.array()
    .items(Joi.string().valid(
      'license_doc',
      'kra_pin_doc',
      'police_clearance',
      'medical_cert',
      'national_id',
    ))
    .optional(),
});

/* ============================================================
   ADMIN — BLACKLIST / UNBLACKLIST
   PATCH /api/v1/admin/drivers/:id/blacklist
   PATCH /api/v1/admin/drivers/:id/unblacklist
   PRD §3.1 — Admin blacklist authority
   ============================================================ */

const blacklistDriverSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required()
    .messages({ 'any.required': 'A blacklist reason is required.' }),
});

/* ============================================================
   REGISTER VEHICLE
   POST /api/v1/vehicle
   POST /api/v1/transporter/fleet
   PRD §8, §14.2
   ============================================================ */

const registerVehicleSchema = Joi.object({

  // ── Identity ─────────────────────────────────────────────
  plate_number:    J.plate.required(),
  make:            Joi.string().min(2).max(50).trim().required(),
  model:           Joi.string().min(1).max(50).trim().required(),
  year:            Joi.number().integer().min(1990).max(new Date().getFullYear()).required(),
  color:           Joi.string().max(30).trim().optional(),
  vehicle_type:    Joi.string().valid(...VEHICLE_TYPES).required(),
  ownership_type:  Joi.string().valid(...OWNERSHIP_TYPES).required(),

  // ── Capacity (PRD §4.1 — Cargo Capacity rule) ────────────
  cargo_capacity_kg:     Joi.number().positive().max(30000).required(),
  cargo_capacity_volume: Joi.number().positive().optional(), // cubic metres

  // ── Ownership links ───────────────────────────────────────
  transporter_id: J.uuid.optional(),
  driver_id:      J.uuid.optional(),   // current assigned driver

  // ── Document URLs (PRD §14.2) ────────────────────────────
  logbook_url:          Joi.string().uri().optional(),
  insurance_url:        Joi.string().uri().optional(),
  insurance_expiry:     Joi.date().iso().optional(),
  ntsa_cert_url:        Joi.string().uri().optional(),
  ntsa_cert_expiry:     Joi.date().iso().optional(),
  inspection_cert_url:  Joi.string().uri().optional(),
  inspection_expiry:    Joi.date().iso().optional(),
});

/* ============================================================
   ADMIN — VERIFY VEHICLE
   PATCH /api/v1/admin/vehicles/:id/verify
   PRD §5.1 Fleet Management
   ============================================================ */

const verifyVehicleSchema = Joi.object({
  insurance_verified:    Joi.boolean().optional(),
  ntsa_verified:         Joi.boolean().optional(),
  inspection_verified:   Joi.boolean().optional(),
  logbook_verified:      Joi.boolean().optional(),
  notes:                 Joi.string().max(500).trim().optional(),
});

/* ============================================================
   ADMIN — BLOCK VEHICLE
   PATCH /api/v1/admin/vehicles/:id/block
   ============================================================ */

const blockVehicleSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required()
    .messages({ 'any.required': 'A block reason is required.' }),
});

/* ============================================================
   TOGGLE AVAILABILITY  (PATCH /api/v1/driver/availability)
   PRD §3.5 — Driver can toggle availability
   ============================================================ */

const toggleAvailabilitySchema = Joi.object({
  is_available: Joi.boolean().required(),
});

/* ============================================================
   UPDATE GPS LOCATION  (PATCH /api/v1/driver/location)
   PRD §14.4 — Real-time GPS tracking during trips
   ============================================================ */

const updateLocationSchema = Joi.object({
  latitude:  J.latitude.required(),
  longitude: J.longitude.required(),
  heading:   Joi.number().min(0).max(360).optional(),  // compass bearing
  speed_kmh: Joi.number().min(0).max(200).optional(),
});

/* ============================================================
   EARNINGS QUERY  (GET /api/v1/driver/earnings)
   PRD §7.18 — Driver Wallet & Earnings
   ============================================================ */

const earningsQuerySchema = Joi.object({
  period:    Joi.string().valid('daily', 'weekly', 'monthly', 'custom').default('monthly'),
  date_from: Joi.when('period', {
    is:   'custom',
    then: Joi.date().iso().required(),
    otherwise: Joi.date().iso().optional(),
  }),
  date_to: Joi.when('period', {
    is:   'custom',
    then: Joi.date().iso().min(Joi.ref('date_from')).required(),
    otherwise: Joi.date().iso().optional(),
  }),
  page:  J.page,
  limit: J.limit,
});

/* ============================================================
   DRIVER ID PARAM
   ============================================================ */

const driverParamSchema = Joi.object({
  id: J.uuid.required(),
});

const vehicleParamSchema = Joi.object({
  id: J.uuid.required(),
});

module.exports = {
  driverProfileSchema,
  driverComplianceSchema,
  approveDriverSchema,
  rejectDriverSchema,
  blacklistDriverSchema,
  registerVehicleSchema,
  verifyVehicleSchema,
  blockVehicleSchema,
  toggleAvailabilitySchema,
  updateLocationSchema,
  earningsQuerySchema,
  driverParamSchema,
  vehicleParamSchema,
};