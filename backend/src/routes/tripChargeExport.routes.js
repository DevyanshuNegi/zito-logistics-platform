// src/routes/tripChargeExport.routes.js
// Admin export for trip charges

const express = require('express');
const router  = express.Router();
const controller = require('../controllers/tripChargeExport.controller');
const { authenticate, isFinanceOrSuper, auditLogger } = require('../middleware/auth');

router.use(authenticate, auditLogger, isFinanceOrSuper);

router.get('/trip-charges', controller.exportTripCharges);

module.exports = router;
