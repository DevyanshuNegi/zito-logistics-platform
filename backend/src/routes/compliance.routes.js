// src/routes/compliance.routes.js
// Admin-only compliance review endpoints

const express = require('express');
const router  = express.Router();
const controller = require('../controllers/compliance.controller');
const { authenticate, isSuperAdmin, auditLogger } = require('../middleware/auth');

router.use(authenticate, auditLogger, isSuperAdmin);

router.get('/drivers/:driverId', controller.getCompliance);
router.patch('/drivers/:driverId/status', controller.updateComplianceStatus);

module.exports = router;
