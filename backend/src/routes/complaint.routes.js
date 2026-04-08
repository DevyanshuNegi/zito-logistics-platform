const express = require('express');
const router  = express.Router();
const controller = require('../controllers/complaint.controller');
const { authenticate, auditLogger, applyScope, authorize, ROLES } = require('../middleware/auth');

router.use(authenticate, auditLogger, applyScope);

// Create complaint (all roles)
router.post('/',
  authorize(...Object.values(ROLES)),
  controller.createComplaint
);

// List complaints (admin sees all, others see own)
router.get('/',
  authorize(...Object.values(ROLES)),
  controller.listComplaints
);

// Admin update status
router.patch('/:id/status',
  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN),
  controller.updateStatus
);

module.exports = router;
