// src/routes/admin.routes.js
// PRD §5.1 — Admin Portal
// PRD §12 — Admin /api/v1/admin/
// PRD §25.4 — Admin Compliance & Approval APIs

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/admin.controller');
const {
  authenticate,
  isAdmin,
  isSuperAdmin,
  applyScope,
  auditLogger,
} = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(authenticate, auditLogger, isAdmin, applyScope);

// ── Dashboard ─────────────────────────────────────────────────────────────
// PRD §5.1 — KPI cards, live map, pending approvals, activity feed
// GET /api/v1/admin/stats
router.get('/stats', controller.getDashboardStats);

// ── User Management ───────────────────────────────────────────────────────
// PRD §5.1 — Create, edit, activate, deactivate users
router.get('/users',          controller.getUsers);
router.post('/users',         controller.createUser);
router.get('/users/:id',      controller.getUserById);
router.patch('/users/:id',    controller.updateUser);
router.delete('/users/:id',   controller.deleteUser);   // soft delete PRD §25.9

// PRD §25.4 — User Compliance Endpoints
router.patch('/users/:id/compliance', isSuperAdmin, controller.updateUserCompliance);
router.patch('/users/:id/lock',       isSuperAdmin, controller.lockUserData);
router.patch('/users/:id/unlock',     isSuperAdmin, controller.unlockUserData);
router.patch('/users/:id/activate',   controller.activateUser);
router.patch('/users/:id/deactivate', controller.deactivateUser);

// ── Driver Management ─────────────────────────────────────────────────────
// PRD §5.1 — Driver verification, document approval
router.get('/drivers',             controller.getDrivers);
router.get('/drivers/:id',         controller.getDriverById);

// PRD §25.4 — Driver Compliance Endpoints
router.patch('/drivers/:id/approve',      controller.approveDriver);
router.patch('/drivers/:id/reject',       controller.rejectDriver);
router.patch('/drivers/:id/resubmit',     controller.requestDriverResubmit);
router.patch('/drivers/:id/blacklist',    controller.blacklistDriver);
router.patch('/drivers/:id/unblacklist',  controller.unblacklistDriver);

// ── Vehicle Management ────────────────────────────────────────────────────
// PRD §5.1 — Fleet management, document tracking
router.get('/vehicles',           controller.getVehicles);
router.get('/vehicles/:id',       controller.getVehicleById);

// PRD §25.4 — Vehicle Verification Endpoints
router.patch('/vehicles/:id/verify',   controller.verifyVehicle);
router.patch('/vehicles/:id/block',    controller.blockVehicle);
router.patch('/vehicles/:id/unblock',  controller.unblockVehicle);

// ── Booking Management ────────────────────────────────────────────────────
// PRD §5.1 — Order Management
router.get('/bookings',              controller.getBookings);
router.get('/bookings/:id',          controller.getBookingById);
router.post('/bookings',             controller.createBooking);
router.patch('/bookings/:id',        controller.updateBooking);
router.patch('/bookings/:id/assign', controller.assignDriver);
router.patch('/bookings/:id/approve',   controller.approveBooking);
router.patch('/bookings/:id/cancel',    controller.cancelBooking);
router.patch('/bookings/:id/complete',  controller.completeBooking);

// ── System Settings ───────────────────────────────────────────────────────
// PRD §3.1 — Super Admin configures assignment mode, pricing, surcharges
router.get('/system-settings',       isSuperAdmin, controller.getSystemSettings);
router.post('/system-settings',      isSuperAdmin, controller.upsertSystemSetting);
router.patch('/system-settings/:key',isSuperAdmin, controller.updateSystemSetting);

// ── Assignment Engine Mode ────────────────────────────────────────────────
// PRD §4 — Admin switches Manual / Semi-Auto / Full Auto
router.patch('/assignment-mode', isSuperAdmin, controller.setAssignmentMode);

// Semi-auto driver suggestions
router.get('/assignment/suggest/:bookingId',
  controller.suggestDrivers
);

// Customer-specific whitelist/blacklist
router.post('/customers/:customerId/driver-rule',
  controller.upsertDriverRule
);
router.delete('/customers/:customerId/driver-rule/:driverId',
  controller.deleteDriverRule
);

// ── View As ───────────────────────────────────────────────────────────────
// PRD §3.1 — Super Admin impersonates any user for support/QA
router.get('/view-as/:userId', isSuperAdmin, controller.viewAsUser);

// ── Audit Log ─────────────────────────────────────────────────────────────
// PRD §25.8 — Immutable audit log, Admin only
router.get('/audit-logs', controller.getAuditLogs);

// ── Reports ───────────────────────────────────────────────────────────────
// PRD §5.1
router.get('/reports/bookings',  controller.bookingReport);
router.get('/reports/financial', controller.financialReport);
router.get('/reports/drivers',   controller.driverReport);
router.get('/reports/export',    controller.exportReport);
router.get('/live/drivers',      controller.liveDrivers);

// ── Maintenance (Danger Zone) ──
router.post('/maintenance/export-all',       isSuperAdmin, controller.exportAllData);
router.post('/maintenance/clear-test-data',  isSuperAdmin, controller.clearTestData);

module.exports = router;
