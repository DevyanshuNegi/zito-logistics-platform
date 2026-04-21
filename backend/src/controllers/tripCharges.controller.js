// src/controllers/tripCharges.controller.js
const prisma = require('../utils/prisma');
const { calculateProfit } = require('../utils/helpers');

/* -------------------------------------------------------------------------- */
/* ADD TRIP CHARGE                                                            */
/* -------------------------------------------------------------------------- */

const addCharge = async (req, res, next) => {
  try {

    const {
      trip_id,
      charge_type,
      amount,
      description,
      driver_id,
    } = req.body;

    const resolvedTripId = trip_id || req.body.booking_id;

    if (!resolvedTripId || !charge_type || !amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'trip_id, charge_type and amount are required',
        },
      });
    }

    const inserted = await TripCharge.create({
      trip_id: resolvedTripId,
      charge_type,
      amount,
      description: description || null,
      driver_id: driver_id || null,
    });

    // Recalculate totals on booking
    await recalcTotals(resolvedTripId);

    return res.status(201).json({
      success: true,
      data: inserted,
    });

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET TRIP CHARGES                                                           */
/* -------------------------------------------------------------------------- */

const getTripCharges = async (req, res, next) => {
  try {

    const { tripId } = req.params;

    const charges = await TripCharge.findAll({
      where: { trip_id: tripId },
      order: [['created_at', 'ASC']],
    });

    return res.json({
      success: true,
      data: charges,
    });

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET DRIVER EXPENSES                                                        */
/* -------------------------------------------------------------------------- */

const getDriverExpenses = async (req, res, next) => {
  try {

    const { driverId } = req.params;

    const expenses = await TripCharge.findAll({
      where: { driver_id: driverId },
      order: [['created_at', 'ASC']],
    });

    return res.json({
      success: true,
      data: expenses,
    });

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET TRIP FINANCIAL SUMMARY                                                 */
/* -------------------------------------------------------------------------- */

const getTripFinancials = async (req, res, next) => {
  try {

    const { tripId } = req.params;

    const booking = await Booking.findByPk(tripId, {
      include: [{ model: TripCharge, as: 'charges' }],
    });
    if (!booking) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    }

    const totalExpenses = booking.charges?.reduce((sum, c) => sum + Number(c.amount || 0), 0) || 0;
    const profit = calculateProfit(booking.customer_rate || booking.final_fare || 0, booking.hire_rate || 0, totalExpenses);

    return res.json({
      success: true,
      data: {
        trip_id: booking.id,
        customer_rate: booking.customer_rate,
        hire_rate: booking.hire_rate,
        total_expenses: totalExpenses,
        profit,
      },
    });

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* APPROVAL FLOWS                                                             */
/* -------------------------------------------------------------------------- */

const approveCharge = async (req, res, next) => {
  try {
    const charge = await TripCharge.findByPk(req.params.id);
    if (!charge) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Charge not found' } });

    await charge.update({ status: 'approved', approved_by: req.user.id, approved_at: new Date() });
    await recalcTotals(charge.trip_id);

    return res.json({ success: true, data: charge });
  } catch (err) { next(err); }
};

const rejectCharge = async (req, res, next) => {
  try {
    const charge = await TripCharge.findByPk(req.params.id);
    if (!charge) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Charge not found' } });

    await charge.update({ status: 'rejected', approved_by: req.user.id, approved_at: new Date() });
    await recalcTotals(charge.trip_id);

    return res.json({ success: true, data: charge });
  } catch (err) { next(err); }
};

/* -------------------------------------------------------------------------- */
/* INTERNAL: RECALC TOTAL EXPENSES & PROFIT                                   */
/* -------------------------------------------------------------------------- */

const recalcTotals = async (tripId) => {
  const charges = await TripCharge.findAll({
    where: { trip_id: tripId, status: 'approved' },
    attributes: ['amount', 'charge_type', 'driver_id'],
  });

  const totalExpenses = charges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const booking = await Booking.findByPk(tripId);
  if (!booking) return;

  const profit = calculateProfit(booking.customer_rate || booking.final_fare || 0, booking.hire_rate || 0, totalExpenses);
  await booking.update({ total_expenses: totalExpenses, profit });

};

module.exports = {
  addCharge,
  getTripCharges,
  getDriverExpenses,
  getTripFinancials,
  approveCharge,
  rejectCharge
};
