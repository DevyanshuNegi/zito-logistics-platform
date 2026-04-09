// src/routes/booking.routes.js
// PRD §6 — Booking Workflow & Status Lifecycle
// PRD §12 — /api/v1/booking/
// PRD §25.2 — Booking Ownership Model

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/booking.controller');
const driverController = require('../controllers/driver.controller');
const adminController = require('../controllers/admin.controller');
const offerController = require('../controllers/bookingOffer.controller');
const {
  authenticate,
  authorize,
  applyScope,
  auditLogger,
  injectBookingOwnership,
  ROLES,
} = require('../middleware/auth');

router.use(authenticate, auditLogger, applyScope);

// Create Booking
// POST /api/v1/booking
router.post('/',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  injectBookingOwnership,
  controller.createBooking
);

// Alias for testing doc: POST /customer/bookings
router.post('/customer',
  authorize(ROLES.CUSTOMER),
  injectBookingOwnership,
  controller.createBooking
);

// List Bookings (scoped by role)
router.get('/', controller.getBookings);

// Price Estimate
router.get('/price-estimate',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.getPriceEstimate
);

// Alias: GET /customer/price-estimate
router.get('/customer/price-estimate',
  authorize(ROLES.CUSTOMER),
  controller.getPriceEstimate
);

// Compatibility: POST /bookings/calculate-price (body -> query)
router.post('/calculate-price',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.TRANSPORTER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  (req, res, next) => {
    // map body to query for existing handler
    req.query = { ...req.body };
    return controller.getPriceEstimate(req, res, next);
  }
);

// My offers (bids)
router.get('/offers/mine',
  authorize(ROLES.DRIVER, ROLES.TRANSPORTER, ROLES.AGENT),
  offerController.listMyOffers
);

// Marketplace Offers
router.get('/:id/offers',
  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.CUSTOMER, ROLES.AGENT, ROLES.TRANSPORTER),
  offerController.listOffers
);

router.post('/:id/offers',
  authorize(ROLES.DRIVER, ROLES.TRANSPORTER, ROLES.AGENT),
  offerController.createOffer
);

router.patch('/:id/offers/:offerId',
  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  offerController.respondToOffer
);

// Get Booking Detail
router.get('/:id', controller.getBookingById);

// Cancel Booking
router.post('/:id/cancel',
  authorize(ROLES.CUSTOMER, ROLES.AGENT, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.cancelBooking
);

// Rate Booking
router.post('/:id/rate',
  authorize(ROLES.CUSTOMER, ROLES.DRIVER),
  controller.rateBooking
);

// Driver accept/reject aliases (compat for older frontend)
router.post('/:id/driver-accept',
  authorize(ROLES.DRIVER),
  driverController.acceptTrip
);
router.post('/:id/driver-reject',
  authorize(ROLES.DRIVER),
  driverController.rejectTrip
);

// Admin assign alias
router.patch('/:id/assign',
  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  adminController.assignDriver
);

// Proof of Delivery upload
router.post('/:id/pod',
  authorize(ROLES.DRIVER),
  controller.uploadPOD
);

// Status Update
router.patch('/:id/status',
  authorize(ROLES.DRIVER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  controller.updateStatus
);

module.exports = router;
