// src/routes/booking.routes.js
// PRD §6 — Booking Workflow & Status Lifecycle
// PRD §12 — /api/v1/booking/
// PRD §25.2 — Booking Ownership Model

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/booking.controller');
const {
  authenticate,
  authorize,
  applyScope,
  auditLogger,
  injectBookingOwnership,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, applyScope);

// ── Create Booking ────────────────────────────────────────────────────────
// PRD §5.2 — Customer Portal, §5.4 — Transporter, §5.5 — Agent
// POST /api/v1/booking
router.post('/',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  injectBookingOwnership,
  controller.createBooking
);

// ── List Bookings ─────────────────────────────────────────────────────────
// PRD §25.1 — filtered by req.scope per role
// GET /api/v1/booking
router.get('/', controller.getBookings);

// ── Get Booking Detail ────────────────────────────────────────────────────
// GET /api/v1/booking/:id
router.get('/:id', controller.getBookingById);

// ── Cancel Booking ────────────────────────────────────────────────────────
// PRD §23 — Cancellation Policy
// POST /api/v1/booking/:id/cancel
router.post('/:id/cancel',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.cancelBooking
);

// ── Rate Booking ──────────────────────────────────────────────────────────
// PRD §21.1 — Rating System (48hr window after completion)
// POST /api/v1/booking/:id/rate
router.post('/:id/rate',
  authorize(ROLES.CUSTOMER, ROLES.DRIVER),
  controller.rateBooking
);

// ── Price Estimate ────────────────────────────────────────────────────────
// PRD §7 — Pricing Engine
// GET /api/v1/booking/price-estimate
router.get('/price-estimate',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.getPriceEstimate
);

// ── Upload Proof of Delivery ──────────────────────────────────────────────
// PRD §5.3 — Driver uploads POD photo
// POST /api/v1/booking/:id/pod
router.post('/:id/pod',
  authorize(ROLES.DRIVER),
  controller.uploadPOD
);

// ── Status Update ─────────────────────────────────────────────────────────
// PRD §6 — Driver updates trip status
// PATCH /api/v1/booking/:id/status
router.patch('/:id/status',
  authorize(ROLES.DRIVER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.updateStatus
);

module.exports = router;
