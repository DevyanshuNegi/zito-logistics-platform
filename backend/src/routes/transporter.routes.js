// src/routes/transporter.routes.js
// PRD §5.4 — Transporter Portal
// PRD §12 — /api/v1/transporter/
// PRD §3.6 — Transporter manages own fleet, drivers, customers, bookings

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/transporter.controller');
const {
  authenticate,
  authorize,
  requireCompliance,
  applyScope,
  auditLogger,
  viewAs,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, viewAs, authorize(ROLES.TRANSPORTER), requireCompliance, applyScope);

// ── Dashboard ─────────────────────────────────────────────────────────────
// PRD §5.4 — Fleet KPI dashboard
// GET /api/v1/transporter/dashboard
router.get('/dashboard', controller.getDashboard);

// ── Fleet Management ──────────────────────────────────────────────────────
// PRD §5.4 — Add, edit, retire vehicles
// GET /api/v1/transporter/fleet
router.get('/fleet',       controller.getFleet);
router.post('/fleet',      controller.addVehicle);
router.get('/fleet/:id',   controller.getVehicleById);
router.patch('/fleet/:id', controller.updateVehicle);
router.delete('/fleet/:id',controller.retireVehicle); // soft delete

// ── Driver Management ─────────────────────────────────────────────────────
// PRD §5.4 — Invite, assign, monitor drivers
// GET /api/v1/transporter/drivers
router.get('/drivers',            controller.getDrivers);
router.post('/drivers/invite',    controller.inviteDriver);
router.get('/drivers/:id',        controller.getDriverById);
router.patch('/drivers/:id',      controller.updateDriver);
router.patch('/drivers/:id/assign-vehicle', controller.assignVehicleToDriver);
router.patch('/drivers/:id/availability',   controller.setDriverAvailability);

// ── Customer Management ───────────────────────────────────────────────────
// PRD §5.4 — Manage transporter-linked customers
// GET /api/v1/transporter/customers
router.get('/customers',       controller.getCustomers);
router.post('/customers',      controller.addCustomer);
router.get('/customers/:id',   controller.getCustomerById);
router.patch('/customers/:id', controller.updateCustomer);

// ── Booking Management ────────────────────────────────────────────────────
// PRD §5.4 — Manage all orders for the fleet
// GET /api/v1/transporter/bookings
router.get('/bookings',             controller.getBookings);
router.post('/bookings',            controller.createBooking);
router.get('/bookings/:id',         controller.getBookingById);
router.patch('/bookings/:id/assign',controller.assignDriver);
router.patch('/bookings/:id/cancel',controller.cancelBooking);

// ── Finance ───────────────────────────────────────────────────────────────
// PRD §5.4 — Revenue summaries, invoicing, contract management
// GET /api/v1/transporter/finance
router.get('/finance',           controller.getFinanceSummary);
router.get('/finance/invoices',  controller.getInvoices);
router.get('/contracts',         controller.getContracts);
router.post('/contracts',        controller.createContract);
router.get('/contracts/:id',     controller.getContractById);
router.patch('/contracts/:id',   controller.updateContract);

module.exports = router;
