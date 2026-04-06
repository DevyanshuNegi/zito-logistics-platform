// src/routes/driver.routes.js
// PRD §5.3 — Driver Portal
// PRD §12 — /api/v1/driver/
// PRD §14 — Compliance (requireCompliance before operational routes)
// PRD §18.1 — Driver Assignment Validation

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/driver.controller');
const {
  authenticate,
  authorize,
  requireCompliance,
  applyScope,
  auditLogger,
  checkDataLock,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, authorize(ROLES.DRIVER), applyScope);

// ── Profile ───────────────────────────────────────────────────────────────
// GET /api/v1/driver/profile
router.get('/profile', controller.getProfile);

// PATCH /api/v1/driver/profile
router.patch('/profile', checkDataLock, controller.updateProfile);

// ── Availability ──────────────────────────────────────────────────────────
// PRD §5.3 — Set availability status
// PATCH /api/v1/driver/availability
router.patch('/availability', requireCompliance, controller.setAvailability);

// ── Trips ─────────────────────────────────────────────────────────────────
// PRD §5.3 — Trip Management
// GET /api/v1/driver/trips
router.get('/trips', controller.getTrips);

// GET /api/v1/driver/trips/:id
router.get('/trips/:id', controller.getTripById);

// POST /api/v1/driver/trips/:id/accept
// PRD §12 — Accept trip assignment
router.post('/trips/:id/accept', requireCompliance, controller.acceptTrip);

// POST /api/v1/driver/trips/:id/reject
// PRD §12 — Reject trip assignment
router.post('/trips/:id/reject', controller.rejectTrip);

// PATCH /api/v1/driver/trips/:id/status
// PRD §12 — Update trip status (Assigned→Accepted→Picked Up→In Transit→Delivered)
router.patch('/trips/:id/status', requireCompliance, controller.updateTripStatus);

// ── Documents ─────────────────────────────────────────────────────────────
// PRD §5.3 — Upload and manage compliance documents
// GET /api/v1/driver/documents
router.get('/documents', controller.getDocuments);

// POST /api/v1/driver/documents
router.post('/documents', controller.uploadDocument);

// ── Earnings ──────────────────────────────────────────────────────────────
// PRD §5.3 — Driver salary/earnings overview (admin-managed, no self-tracking)
// PRD — drivers on salary, paid directly, no profit tracking
// GET /api/v1/driver/earnings
router.get('/earnings', controller.getEarnings);

// ── Location ──────────────────────────────────────────────────────────────
// PRD §18.5 — GPS tracking during trips
// PATCH /api/v1/driver/location
router.patch('/location', requireCompliance, controller.updateLocation);

// ── Dashboard ─────────────────────────────────────────────────────────────
// GET /api/v1/driver/dashboard
router.get('/dashboard', controller.getDashboard);

module.exports = router;