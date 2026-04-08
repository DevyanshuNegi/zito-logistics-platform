// src/routes/map.routes.js
// Free map endpoints (geocode, reverse, distance)

const express = require('express');
const router  = express.Router();
const controller = require('../controllers/map.controller');
const { authenticate, auditLogger } = require('../middleware/auth');

// Maps are read-only; still require auth to prevent abuse in prod.
router.use(authenticate, auditLogger);

router.get('/geocode', controller.search);
router.get('/reverse', controller.reverse);
router.get('/distance', controller.distance);

module.exports = router;
