// src/routes/customer.routes.js
// PRD §5.2 — Customer Portal
// PRD §12 — /api/v1/customer/

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/customer.controller');
const {
  authenticate,
  authorize,
  applyScope,
  auditLogger,
  checkDataLock,
  viewAs,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, viewAs, authorize(ROLES.CUSTOMER), applyScope);

// ── Profile ───────────────────────────────────────────────────────────────
// GET /api/v1/customer/profile
router.get('/profile', controller.getProfile);

// PATCH /api/v1/customer/profile
router.patch('/profile', checkDataLock, controller.updateProfile);

// ── Bookings ──────────────────────────────────────────────────────────────
// PRD §5.2 — Create, track, manage bookings
// GET /api/v1/customer/bookings
router.get('/bookings', controller.getBookings);

// GET /api/v1/customer/bookings/:id
router.get('/bookings/:id', controller.getBookingById);

// POST /api/v1/customer/bookings
router.post('/bookings', controller.createBooking);

// POST /api/v1/customer/bookings/:id/cancel
// PRD §23 — Cancellation Policy
router.post('/bookings/:id/cancel', controller.cancelBooking);

// POST /api/v1/customer/bookings/:id/rate
// PRD §21.1 — Rate completed booking (48hr window)
router.post('/bookings/:id/rate', controller.rateBooking);

// ── Price Estimate ────────────────────────────────────────────────────────
// PRD §7 — Real-time price estimate before booking
// GET /api/v1/customer/price-estimate
router.get('/price-estimate', controller.getPriceEstimate);

// ── Tracking ──────────────────────────────────────────────────────────────
// PRD §5.2 — Live driver location and ETA
// GET /api/v1/customer/bookings/:id/track
router.get('/bookings/:id/track', controller.trackBooking);

// ── Invoices & Receipts ───────────────────────────────────────────────────
// PRD §5.2 — Download PDF receipts
// GET /api/v1/customer/bookings/:id/invoice
router.get('/bookings/:id/invoice', controller.getInvoice);

// ── Dashboard ─────────────────────────────────────────────────────────────
// GET /api/v1/customer/dashboard
router.get('/dashboard', controller.getDashboard);

module.exports = router;
