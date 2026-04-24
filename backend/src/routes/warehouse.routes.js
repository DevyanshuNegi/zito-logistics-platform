const express = require('express');
const router = express.Router();
const controller = require('../controllers/warehouse.controller');
const {
  authenticate,
  authorize,
  applyScope,
  auditLogger,
  ROLES,
} = require('../middleware/auth');

const WAREHOUSE_READ_ROLES = [
  ROLES.WAREHOUSE_PARTNER,
  ROLES.SUPER_ADMIN,
  ROLES.OPERATIONS_ADMIN,
  ROLES.FINANCE_ADMIN,
];

const WAREHOUSE_WRITE_ROLES = [
  ROLES.WAREHOUSE_PARTNER,
  ROLES.SUPER_ADMIN,
  ROLES.OPERATIONS_ADMIN,
];

router.use(authenticate, auditLogger, applyScope);

router.get('/dashboard',
  authorize(...WAREHOUSE_READ_ROLES),
  controller.getDashboard
);

router.get('/spaces',
  authorize(...WAREHOUSE_READ_ROLES),
  controller.getSpaces
);

router.post('/spaces',
  authorize(...WAREHOUSE_WRITE_ROLES),
  controller.createSpace
);

router.get('/spaces/:id',
  authorize(...WAREHOUSE_READ_ROLES),
  controller.getSpaceById
);

router.patch('/spaces/:id',
  authorize(...WAREHOUSE_WRITE_ROLES),
  controller.updateSpace
);

router.get('/bookings',
  authorize(ROLES.CUSTOMER, ...WAREHOUSE_READ_ROLES),
  controller.getStorageBookings
);

router.post('/bookings',
  authorize(ROLES.CUSTOMER, ...WAREHOUSE_WRITE_ROLES),
  controller.createStorageBooking
);

router.get('/bookings/:id',
  authorize(ROLES.CUSTOMER, ...WAREHOUSE_READ_ROLES),
  controller.getStorageBookingById
);

router.patch('/bookings/:id/status',
  authorize(...WAREHOUSE_WRITE_ROLES),
  controller.updateStorageBookingStatus
);

router.get('/inventory',
  authorize(ROLES.CUSTOMER, ...WAREHOUSE_READ_ROLES),
  controller.getInventoryRecords
);

router.get('/inventory/:id',
  authorize(ROLES.CUSTOMER, ...WAREHOUSE_READ_ROLES),
  controller.getInventoryRecordById
);

router.post('/bookings/:id/inventory',
  authorize(...WAREHOUSE_WRITE_ROLES),
  controller.createInventoryRecord
);

router.patch('/inventory/:id',
  authorize(...WAREHOUSE_WRITE_ROLES),
  controller.updateInventoryRecord
);

module.exports = router;
