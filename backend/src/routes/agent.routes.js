// src/routes/agent.routes.js
// PRD §5.5 — Agent Portal
// PRD §20 — Agent API Endpoints /api/v1/agent/

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/agent.controller');
const {
  authenticate,
  authorize,
  applyScope,
  auditLogger,
  injectBookingOwnership,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, authorize(ROLES.AGENT), applyScope);

// ── Dashboard ─────────────────────────────────────────────────────────────
// PRD §20 — Agent KPI dashboard
// GET /api/v1/agent/dashboard
router.get('/dashboard', controller.getDashboard);

// ── Customer Management ───────────────────────────────────────────────────
// PRD §5.5, §20 — Manage agent's customer portfolio
// GET /api/v1/agent/customers
router.get('/customers',       controller.getCustomers);
router.post('/customers',      controller.addCustomer);
router.get('/customers/:id',   controller.getCustomerById);

// ── Booking Management ────────────────────────────────────────────────────
// PRD §5.5, §20 — Create bookings on behalf of customers
// GET /api/v1/agent/bookings
router.get('/bookings',              controller.getBookings);
router.post('/bookings',             injectBookingOwnership, controller.createBooking);
router.get('/bookings/:id',          controller.getBookingById);
router.post('/bookings/:id/cancel',  controller.cancelBooking);

// ── Profile ───────────────────────────────────────────────────────────────
// GET /api/v1/agent/profile
router.get('/profile',    controller.getProfile);
router.patch('/profile',  controller.updateProfile);

module.exports = router;
