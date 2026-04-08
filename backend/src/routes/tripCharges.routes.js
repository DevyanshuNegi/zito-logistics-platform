// src/routes/tripCharges.routes.js

const express = require('express');
const router = express.Router();
const {
  addCharge,
  getTripCharges,
  getDriverExpenses,
  getTripFinancials,
  approveCharge,
  rejectCharge,
} = require('../controllers/tripCharges.controller');
const { authenticate, auditLogger, authorize, ROLES, isAdmin } = require('../middleware/auth');

router.use(authenticate, auditLogger);

/* -------------------------------------------------------------------------- */
/* ADD TRIP CHARGE                                                            */
/* POST /api/v1/trip-charges                                                  */
/* -------------------------------------------------------------------------- */

router.post('/',
  authorize(ROLES.DRIVER, ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN),
  addCharge
);

/* -------------------------------------------------------------------------- */
/* GET CHARGES FOR A TRIP                                                     */
/* GET /api/v1/trip-charges/trip/:tripId                                      */
/* -------------------------------------------------------------------------- */

router.get('/trip/:tripId', getTripCharges);

/* -------------------------------------------------------------------------- */
/* GET DRIVER EXPENSES                                                        */
/* GET /api/v1/trip-charges/driver/:driverId                                  */
/* -------------------------------------------------------------------------- */

router.get('/driver/:driverId', getDriverExpenses);

/* -------------------------------------------------------------------------- */
/* GET TRIP FINANCIAL SUMMARY                                                 */
/* GET /api/v1/trip-charges/financials/:tripId                                */
/* -------------------------------------------------------------------------- */

router.get('/financials/:tripId', getTripFinancials);

/* -------------------------------------------------------------------------- */
/* APPROVE / REJECT CHARGE (Admin only)                                       */
/* -------------------------------------------------------------------------- */
router.patch('/:id/approve', authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN), approveCharge);
router.patch('/:id/reject',  authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN), rejectCharge);

module.exports = router;
