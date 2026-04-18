// src/routes/compliance.routes.js
// Admin-only compliance review endpoints

const express = require('express');
const router  = express.Router();
const controller = require('../controllers/compliance.controller');
const { authenticate, authorize, auditLogger, ROLES } = require('../middleware/auth');

router.use(
  authenticate,
  auditLogger,
  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
);

router.get('/drivers/:driverId', controller.getCompliance);
router.patch('/drivers/:driverId/status', controller.updateComplianceStatus);
router.patch('/drivers/bulk-status', controller.updateBulkComplianceStatus);

module.exports = router;
