// src/routes/payment.routes.js
// PRD §25.6 — Payment Hold & Release Lifecycle
// PRD §9 — M-Pesa Daraja API (Phase 2)
// PRD §3.3 — Finance Admin manages payments

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/payment.controller');
const {
  authenticate,
  isAdmin,
  isFinanceOrSuper,
  authorize,
  applyScope,
  auditLogger,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, applyScope);

// ── Get Payments ──────────────────────────────────────────────────────────
// PRD §3.3 — Finance Admin views all payments
// GET /api/v1/payment
router.get('/', isFinanceOrSuper, controller.getPayments);

// ── Get Payment by ID ─────────────────────────────────────────────────────
// GET /api/v1/payment/:id
router.get('/:id', isFinanceOrSuper, controller.getPaymentById);

// ── Initiate Payment ──────────────────────────────────────────────────────
// PRD §25.6 — Payment collected → held
// POST /api/v1/payment/initiate
router.post('/initiate',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.TRANSPORTER),
  controller.initiatePayment
);

// ── M-Pesa STK Push ───────────────────────────────────────────────────────
// PRD §9 — Phase 2: M-Pesa Daraja API
// POST /api/v1/payment/mpesa/stk-push
router.post('/mpesa/stk-push',
  authorize(ROLES.CUSTOMER),
  controller.mpesaStkPush
);

// ── M-Pesa Callback ───────────────────────────────────────────────────────
// POST /api/v1/payment/mpesa/callback (no auth — called by Safaricom)
router.post('/mpesa/callback', controller.mpesaCallback);

// ── Release Payment ───────────────────────────────────────────────────────
// PRD §25.6 — Released after booking = completed
// PATCH /api/v1/payment/:id/release
router.patch('/:id/release', isFinanceOrSuper, controller.releasePayment);

// ── Refund Payment ────────────────────────────────────────────────────────
// PRD §25.6, §23.6 — Refund on cancellation or dispute
// PATCH /api/v1/payment/:id/refund
router.patch('/:id/refund', isFinanceOrSuper, controller.refundPayment);

// ── Freeze Payment ────────────────────────────────────────────────────────
// PRD §25.6 — Frozen during dispute
// PATCH /api/v1/payment/:id/freeze
router.patch('/:id/freeze', isFinanceOrSuper, controller.freezePayment);

// ── Generate Invoice ──────────────────────────────────────────────────────
// PRD §24.2 — Invoice generated notification (email with PDF)
// GET /api/v1/payment/:id/invoice
router.get('/:id/invoice',
  authorize(ROLES.CUSTOMER, ROLES.TRANSPORTER, ROLES.AGENT, ROLES.FINANCE_ADMIN, ROLES.SUPER_ADMIN),
  controller.generateInvoice
);

module.exports = router;