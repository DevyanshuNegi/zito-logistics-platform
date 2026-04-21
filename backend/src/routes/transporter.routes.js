const express = require('express');
const router = express.Router();
const transporterController = require('../controllers/transporter.controller');
const { authenticate, authorize, applyScope, requireCompliance, ROLES } = require('../middleware/auth');

// All transporter routes require authentication, the transporter role, and scoping
router.use(authenticate);
router.use(authorize(ROLES.TRANSPORTER));
router.use(applyScope);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/dashboard', transporterController.getDashboard);
router.patch('/update', transporterController.updateTransporter);

// ── Fleet Management ────────────────────────────────────────────────────────
router.get('/fleet', transporterController.getFleet);
router.post('/fleet', transporterController.addVehicle);
router.get('/fleet/:id', transporterController.getVehicleById);
router.patch('/fleet/:id', transporterController.updateVehicle);
router.delete('/fleet/:id', transporterController.retireVehicle);

// ── Driver Management ───────────────────────────────────────────────────────
// Managing drivers requires the transporter to be compliant
router.get('/drivers', requireCompliance, transporterController.getDrivers);
router.post('/drivers/invite', requireCompliance, transporterController.inviteDriver);
router.get('/drivers/:id', transporterController.getDriverById);
router.patch('/drivers/:id', transporterController.updateDriver);

// ── Customer Management ─────────────────────────────────────────────────────
router.get('/customers', transporterController.getCustomers);
router.post('/customers', transporterController.addCustomer);
router.get('/customers/:id', transporterController.getCustomerById);
router.patch('/customers/:id', transporterController.updateCustomer);

// ── Booking Management ──────────────────────────────────────────────────────
router.get('/bookings', transporterController.getBookings);
router.post('/bookings', transporterController.createBooking);
router.get('/bookings/:id', transporterController.getBookingById);
router.patch('/bookings/:id/assign', requireCompliance, transporterController.assignDriver);
router.post('/bookings/:id/cancel', transporterController.cancelBooking);

// ── Finance ────────────────────────────────────────────────────────────────
// PRD §5.4: Transporters view own P&L and invoices
router.get('/finance/summary', transporterController.getFinanceSummary);
router.get('/finance/invoices', transporterController.getInvoices);

// ── Contracts ──────────────────────────────────────────────────────────────
router.get('/contracts', transporterController.getContracts);
router.post('/contracts', transporterController.createContract);
router.get('/contracts/:id', transporterController.getContractById);
router.patch('/contracts/:id', transporterController.updateContract);

/**
 * DEBUG TIP: If you encounter "argument handler must be a function", 
 * uncomment the line below to check which export is missing.
 * Object.keys(transporterController).forEach(key => console.log(`${key}: ${typeof transporterController[key]}`));
 */

module.exports = router;