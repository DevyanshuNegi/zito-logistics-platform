// src/routes/paymentExport.routes.js
// Admin exports for payments

const express = require('express');
const router  = express.Router();
const controller = require('../controllers/paymentExport.controller');
const { authenticate, isFinanceOrSuper, auditLogger } = require('../middleware/auth');

router.use(authenticate, auditLogger, isFinanceOrSuper);

router.get('/payments', controller.exportPayments);

module.exports = router;
