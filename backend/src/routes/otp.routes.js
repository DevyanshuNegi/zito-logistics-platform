// src/routes/otp.routes.js
// PRD §12 — OTP endpoints mounted under /api/v1/auth/

const router = require('express').Router();
const otp    = require('../controllers/otp.controller');

// POST /api/v1/auth/send-otp
router.post('/send-otp',   otp.sendOtp);

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', otp.verifyOtp);

module.exports = router;