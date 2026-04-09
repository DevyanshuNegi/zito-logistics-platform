const express = require('express');
const router = express.Router();
const controller = require('../controllers/help.controller');
const { authenticate, auditLogger, applyScope, authorize, isAdmin, ROLES } = require('../middleware/auth');

router.use(authenticate, auditLogger, applyScope);

router.post(
  '/',
  authorize(ROLES.CUSTOMER, ROLES.DRIVER, ROLES.AGENT, ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN),
  controller.createHelpRequest
);

router.post(
  '/sos',
  authorize(ROLES.CUSTOMER, ROLES.DRIVER, ROLES.AGENT, ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN),
  controller.triggerSos
);

router.patch(
  '/bookings/:bookingId/unfreeze',
  isAdmin,
  controller.unfreezeBooking
);

module.exports = router;
