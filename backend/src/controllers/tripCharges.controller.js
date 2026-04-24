// src/controllers/tripCharges.controller.js
// PRD §7.2 — Trip Charges (toll, fuel, loading, etc.)
// PRD §44.3 — Fuel Management System (expected vs actual)
const prisma = require('../utils/prisma');
const { calculateProfit, roundMoney } = require('../utils/helpers');
const { success, error } = require('../utils/response');
const fraudService = require('../services/fraudDetection.service');

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
      fuel_actual_liters,
      fuel_expected_liters,
      driver_id,
    } = req.body;

    const resolvedTripId = trip_id || req.body.booking_id;

    if (!resolvedTripId || !charge_type || !amount) {
      return error(res, 400, 'VALIDATION_ERROR', 'trip_id, charge_type and amount are required');
    }

    const inserted = await prisma.tripCharge.create({
      data: {
        bookingId: resolvedTripId,
        chargeType: charge_type,
        amount: Number(amount),
        description: description || null,
        fuelActualLiters: fuel_actual_liters ? Number(fuel_actual_liters) : null,
        fuelExpectedLiters: fuel_expected_liters ? Number(fuel_expected_liters) : null,
        driverId: driver_id || null,
        status: 'pending' // Default to pending for admin approval per PRD §35
      }
    });

    // Recalculate totals on booking
    await recalcTotals(resolvedTripId);

    // PRD §44.7 — Automatic Fraud Check
    if (charge_type === 'fuel') {
      await fraudService.detectFuelFraud(inserted.id);
    }

    if (req.auditLog) await req.auditLog('TRIP_CHARGE_ADDED', { charge_id: inserted.id, booking_id: resolvedTripId });

    return success(res, inserted, 'Trip charge added', 201);

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET TRIP CHARGES                                                           */
/* -------------------------------------------------------------------------- */

const getTripCharges = async (req, res, next) => {
  try {

    const { id } = req.params;

    const charges = await prisma.tripCharge.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: 'asc' },
    });

    return success(res, charges, 'Trip charges retrieved');

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET DRIVER EXPENSES                                                        */
/* -------------------------------------------------------------------------- */

const getDriverExpenses = async (req, res, next) => {
  try {

    const { id } = req.params;

    const expenses = await prisma.tripCharge.findMany({
      where: { driverId: id },
      orderBy: { createdAt: 'asc' },
    });

    return success(res, expenses, 'Driver expenses retrieved');

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET TRIP FINANCIAL SUMMARY                                                 */
/* -------------------------------------------------------------------------- */

const getTripFinancials = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { tripCharges: true },
    });

    if (!booking) return error(res, 404, 'NOT_FOUND', 'Trip not found');

    const totalExpenses = booking.tripCharges?.reduce((sum, c) => sum + Number(c.amount || 0), 0) || 0;
    const profit = calculateProfit(booking.customer_rate || booking.final_fare || 0, booking.hire_rate || 0, totalExpenses);

    return success(res, {
      trip_id: booking.id,
      customer_rate: booking.customerRate,
      hire_rate: booking.hireRate,
      total_expenses: totalExpenses,
      profit,
      fuel_variance_liters: booking.tripCharges.reduce((acc, c) => acc + (Number(c.fuelActualLiters || 0) - Number(c.fuelExpectedLiters || 0)), 0)
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
    const charge = await prisma.tripCharge.findUnique({ where: { id: req.params.id } });
    if (!charge) return error(res, 404, 'NOT_FOUND', 'Charge not found');

    const updated = await prisma.tripCharge.update({
      where: { id: charge.id },
      data: { 
        status: 'approved', 
        approvedBy: req.user.id, 
        approvedAt: new Date() 
      }
    });

    await recalcTotals(charge.bookingId);
    if (req.auditLog) await req.auditLog('TRIP_CHARGE_APPROVED', { charge_id: charge.id });

    return success(res, updated, 'Charge approved');
  } catch (err) { next(err); }
};

const rejectCharge = async (req, res, next) => {
  try {
    const charge = await prisma.tripCharge.findUnique({ where: { id: req.params.id } });
    if (!charge) return error(res, 404, 'NOT_FOUND', 'Charge not found');

    const updated = await prisma.tripCharge.update({
      where: { id: charge.id },
      data: { 
        status: 'rejected', 
        approvedBy: req.user.id, 
        approvedAt: new Date() 
      }
    });

    await recalcTotals(charge.bookingId);
    if (req.auditLog) await req.auditLog('TRIP_CHARGE_REJECTED', { charge_id: charge.id });

    return success(res, updated, 'Charge rejected');
  } catch (err) { next(err); }
};

/* -------------------------------------------------------------------------- */
/* INTERNAL: RECALC TOTAL EXPENSES & PROFIT                                   */
/* -------------------------------------------------------------------------- */

const recalcTotals = async (tripId) => {
  const charges = await prisma.tripCharge.findMany({
    where: { bookingId: tripId, status: 'approved' },
    select: { amount: true },
  });

  const totalExpenses = charges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const booking = await prisma.booking.findUnique({ where: { id: tripId } });
  if (!booking) return;

  const profit = calculateProfit(booking.customer_rate || booking.final_fare || 0, booking.hire_rate || 0, totalExpenses);
  await prisma.booking.update({
    where: { id: tripId },
    data: { totalExpenses, profit }
  });

};

module.exports = {
  addCharge,
  getTripCharges,
  getDriverExpenses,
  getTripFinancials,
  approveCharge,
  rejectCharge
};
