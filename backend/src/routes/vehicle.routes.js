// src/routes/vehicle.routes.js
// PRD §5.1 — Admin Fleet Management
// PRD §12 — /api/v1/vehicle/
// PRD §18.2 — Vehicle Assignment Validation
// PRD §25.4 — Vehicle Verification Endpoints

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/vehicle.controller');
const {
  authenticate,
  isAdmin,
  authorize,
  applyScope,
  auditLogger,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, applyScope);

// ── List Vehicles ─────────────────────────────────────────────────────────
// Admin sees all, Transporter sees own fleet (via scope)
// GET /api/v1/vehicle
router.get('/', controller.getVehicles);

// ── Get Vehicle ───────────────────────────────────────────────────────────
// GET /api/v1/vehicle/:id
router.get('/:id', controller.getVehicleById);

// ── Register Vehicle ──────────────────────────────────────────────────────
// PRD §5.4 — Transporter adds vehicle
// POST /api/v1/vehicle
router.post('/',
  authorize(ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.registerVehicle
);

// ── Update Vehicle ────────────────────────────────────────────────────────
// PATCH /api/v1/vehicle/:id
router.patch('/:id',
  authorize(ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.updateVehicle
);

// ── Retire Vehicle ────────────────────────────────────────────────────────
// PRD §25.9 — Soft delete
// DELETE /api/v1/vehicle/:id
router.delete('/:id',
  authorize(ROLES.TRANSPORTER, ROLES.SUPER_ADMIN),
  controller.retireVehicle
);

// ── Document Upload ───────────────────────────────────────────────────────
// PRD §14.7 — Insurance, NTSA, Inspection
// POST /api/v1/vehicle/:id/documents
router.post('/:id/documents',
  authorize(ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.uploadDocument
);

// Expiring documents
router.get('/expiring/list',
  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN),
  controller.getExpiringDocuments
);

module.exports = router;
