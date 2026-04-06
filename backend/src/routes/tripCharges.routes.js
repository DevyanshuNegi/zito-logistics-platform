// src/routes/tripCharges.routes.js

const express = require('express');
const router = express.Router();

const {
  addCharge,
  getTripCharges,
  getDriverExpenses,
  getTripFinancials
} = require('../controllers/tripCharges.controller');

/* -------------------------------------------------------------------------- */
/* ADD TRIP CHARGE                                                            */
/* POST /api/v1/trip-charges                                                  */
/* -------------------------------------------------------------------------- */

router.post('/', addCharge);

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

module.exports = router;