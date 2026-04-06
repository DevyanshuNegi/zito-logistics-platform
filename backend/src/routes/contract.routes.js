// src/routes/contract.routes.js
// PRD §3.3 — Finance Admin manages contract rates
// PRD §5.4 — Transporter contract management
// PRD §7 — Custom pricing via contracts

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/contract.controller');
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

// ── List Contracts ────────────────────────────────────────────────────────
// GET /api/v1/contract
router.get('/',
  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN, ROLES.TRANSPORTER),
  controller.getContracts
);

// ── Get Contract ──────────────────────────────────────────────────────────
// GET /api/v1/contract/:id
router.get('/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN, ROLES.TRANSPORTER),
  controller.getContractById
);

// ── Create Contract ───────────────────────────────────────────────────────
// PRD §5.4 — Transporter or Admin creates contract
// POST /api/v1/contract
router.post('/',
  authorize(ROLES.SUPER_ADMIN, ROLES.FINANCE_ADMIN, ROLES.TRANSPORTER),
  controller.createContract
);

// ── Update Contract ───────────────────────────────────────────────────────
// PATCH /api/v1/contract/:id
router.patch('/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.FINANCE_ADMIN, ROLES.TRANSPORTER),
  controller.updateContract
);

// ── Contract Rates ────────────────────────────────────────────────────────
// PRD §7 — Per vehicle type rate cards
// GET /api/v1/contract/:id/rates
router.get('/:id/rates',    controller.getContractRates);
router.post('/:id/rates',   isFinanceOrSuper, controller.addContractRate);
router.patch('/:id/rates/:rateId', isFinanceOrSuper, controller.updateContractRate);
router.delete('/:id/rates/:rateId',isFinanceOrSuper, controller.deleteContractRate);

module.exports = router;