// src/routes/agency.routes.js
// PRD §5.6 — Agency Portal
// PRD §20 — Agency API Endpoints /api/v1/agency/

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/agency.controller');
const {
  authenticate,
  authorize,
  applyScope,
  auditLogger,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, authorize(ROLES.AGENCY), applyScope);

// ── Dashboard ─────────────────────────────────────────────────────────────
// PRD §20 — Consolidated Agency KPI dashboard
// GET /api/v1/agency/dashboard
router.get('/dashboard', controller.getDashboard);

// ── Agent Management ──────────────────────────────────────────────────────
// PRD §5.6, §20 — Create and manage Agent sub-accounts
// GET /api/v1/agency/agents
router.get('/agents',        controller.getAgents);
router.post('/agents',       controller.createAgent);
router.get('/agents/:id',    controller.getAgentById);
router.patch('/agents/:id',  controller.updateAgent);

// ── Transporter Management ────────────────────────────────────────────────
// PRD §5.6, §20 — Optional Transporter sub-accounts
// GET /api/v1/agency/transporters
router.get('/transporters',        controller.getTransporters);
router.post('/transporters',       controller.linkTransporter);
router.get('/transporters/:id',    controller.getTransporterById);

// ── Bookings ──────────────────────────────────────────────────────────────
// PRD §20 — View all bookings across all managed accounts
// GET /api/v1/agency/bookings
router.get('/bookings', controller.getBookings);

// ── Reports ───────────────────────────────────────────────────────────────
// PRD §5.6, §20 — Agency-level financial and activity reports
// GET /api/v1/agency/reports
router.get('/reports',        controller.getReports);
router.get('/reports/export', controller.exportReports);

// ── Profile ───────────────────────────────────────────────────────────────
// GET /api/v1/agency/profile
router.get('/profile',    controller.getProfile);
router.patch('/profile',  controller.updateProfile);

module.exports = router;
