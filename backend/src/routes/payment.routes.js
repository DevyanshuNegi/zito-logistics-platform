// src/routes/payment.routes.js
// PRD Â§25.6 â€” Payment Hold & Release Lifecycle
// PRD Â§9 â€” M-Pesa Daraja API (Phase 2, sandbox-friendly)
// PRD Â§3.3 â€” Finance Admin manages payments

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/payment.controller');
const {
  authenticate,
  isFinanceOrSuper,
  authorize,
  applyScope,
  auditLogger,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, applyScope);

// Payments list/detail (stub)
router.get('/',    isFinanceOrSuper, controller.getPayments);
router.get('/:id', isFinanceOrSuper, controller.getPaymentById);

// Initiate payment intent
router.post('/initiate',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.TRANSPORTER),
  controller.initiatePayment
);

// M-Pesa sandbox STK push (mock)
router.post('/mpesa/stk-push',
  authorize(ROLES.CUSTOMER),
  controller.mpesaStkPush
);

// Mock callback to mark payment as paid/failed during local testing
router.post('/mpesa/mock-callback', controller.mpesaMockCallback);

// Production-style callback endpoint (still accepts sandbox payload)
router.post('/mpesa/callback', controller.mpesaCallback);

// Release / refund / freeze
router.patch('/:id/release', isFinanceOrSuper, controller.releasePayment);
router.patch('/:id/refund',  isFinanceOrSuper, controller.refundPayment);
router.patch('/:id/freeze',  isFinanceOrSuper, controller.freezePayment);

// Invoice stub
router.get('/:id/invoice',
  authorize(ROLES.CUSTOMER, ROLES.TRANSPORTER, ROLES.AGENT, ROLES.FINANCE_ADMIN, ROLES.SUPER_ADMIN),
  controller.generateInvoice
);

module.exports = router;
