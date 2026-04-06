// src/controllers/customer.controller.js
// PRD §5.2 — Customer Portal
// PRD §12 — /api/v1/customer/
// PRD §7  — Pricing Engine
// PRD §23 — Cancellation Policy
// PRD §21 — Rating System

const { Op }     = require('sequelize');
const { User, Driver, Vehicle, Booking, Contract, ContractRate } = require('../models');
const { success, error }   = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

// ── Dashboard ──────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const customer_id = req.user.id;
    const [total, active, completed, cancelled] = await Promise.all([
      Booking.count({ where: { customer_id } }),
      Booking.count({ where: { customer_id, status: ['assigned','accepted','picked_up','in_transit'] } }),
      Booking.count({ where: { customer_id, status: 'completed' } }),
      Booking.count({ where: { customer_id, status: 'cancelled' } }),
    ]);
    return success(res, { total, active, completed, cancelled });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Profile ────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
    });
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const allowed = ['full_name', 'phone', 'profile_photo', 'date_of_birth'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    await user.update(updates);
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Bookings ───────────────────────────────────────────────────────────────
exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status } = req.query;
    const where = { customer_id: req.user.id };
    if (status) where.status = status;

    const { count, rows } = await Booking.findAndCountAll({
      where, limit, offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: Driver,  as: 'driver',  include: [{ model: User, as: 'user', attributes: ['id','full_name','phone'] }] },
        { model: Vehicle, as: 'vehicle', attributes: ['id','plate_number','vehicle_type','make','model'] },
      ],
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.id, customer_id: req.user.id },
      include: [
        { model: Driver,  as: 'driver',  include: [{ model: User, as: 'user', attributes: ['id','full_name','phone'] }] },
        { model: Vehicle, as: 'vehicle' },
      ],
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createBooking = async (req, res) => {
  try {
    const ref = 'ZT' + Date.now().toString(36).toUpperCase();
    const booking = await Booking.create({
      ...req.body,
      reference:       ref,
      customer_id:     req.user.id,
      created_by_role: req.user.role,
      created_by_id:   req.user.id,
      handled_by:      'admin',
      status:          'pending',
    });
    if (req.auditLog) await req.auditLog('BOOKING_CREATED', { booking_id: booking.id });
    return success(res, { booking }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findOne({ where: { id: req.params.id, customer_id: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    // PRD §23 — cannot cancel after picked_up
    if (['picked_up','in_transit','delivered','completed'].includes(booking.status)) {
      return error(res, 'CANCEL_NOT_ALLOWED', 'Cannot cancel booking at this stage', 400);
    }
    await booking.update({ status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date() });
    if (req.auditLog) await req.auditLog('BOOKING_CANCELLED', { booking_id: booking.id, reason });
    return success(res, { message: 'Booking cancelled', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.rateBooking = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return error(res, 'VALIDATION_ERROR', 'Rating must be between 1 and 5', 422);
    }
    const booking = await Booking.findOne({ where: { id: req.params.id, customer_id: req.user.id, status: 'completed' } });
    if (!booking) return error(res, 'NOT_FOUND', 'Completed booking not found', 404);

    // PRD §21.1 — 48hr rating window
    const completed = new Date(booking.completed_at);
    const hours = (Date.now() - completed.getTime()) / (1000 * 60 * 60);
    if (hours > 48) return error(res, 'RATING_WINDOW_CLOSED', 'Rating window of 48 hours has passed', 400);

    // Update driver average rating
    if (booking.assigned_driver_id) {
      const driver = await Driver.findByPk(booking.assigned_driver_id);
      if (driver) {
        const newTotal  = driver.total_ratings + 1;
        const newRating = ((driver.avg_rating * driver.total_ratings) + rating) / newTotal;
        await driver.update({ avg_rating: newRating.toFixed(2), total_ratings: newTotal });
      }
    }

    if (req.auditLog) await req.auditLog('BOOKING_RATED', { booking_id: booking.id, rating, comment });
    return success(res, { message: 'Rating submitted successfully' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Price Estimate ─────────────────────────────────────────────────────────
// PRD §7 — Pricing Engine
exports.getPriceEstimate = async (req, res) => {
  try {
    const { vehicle_type, distance_km, cargo_weight_kg, is_night, is_holiday, is_heavy } = req.query;

    // PRD §7 — Default Vehicle Pricing
    const rates = {
      motorcycle:  { base: 200,  per_km: 15  },
      pickup:      { base: 1000, per_km: 50  },
      van:         { base: 1500, per_km: 60  },
      truck:       { base: 3000, per_km: 80  },
      articulated: { base: 8000, per_km: 150 },
    };

    const rate = rates[vehicle_type] || rates.pickup;
    const dist = parseFloat(distance_km) || 0;
    let price  = rate.base + (dist * rate.per_km);

    // PRD §7 — Surcharges
    if (is_heavy   === 'true') price *= 1.20;
    if (is_night   === 'true') price *= 1.15;
    if (is_holiday === 'true') price *= 1.10;

    return success(res, {
      vehicle_type,
      distance_km:    dist,
      base_rate:      rate.base,
      per_km_rate:    rate.per_km,
      estimated_fare: Math.round(price),
      currency:       'KES',
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Tracking ───────────────────────────────────────────────────────────────
exports.trackBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.id, customer_id: req.user.id },
      include: [{
        model: Driver, as: 'driver',
        attributes: ['id','current_lat','current_lng','location_updated','is_available'],
        include: [{ model: User, as: 'user', attributes: ['id','full_name','phone'] }],
      }],
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Invoice ────────────────────────────────────────────────────────────────
exports.getInvoice = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.id, customer_id: req.user.id },
      include: [{ model: Vehicle, as: 'vehicle', attributes: ['plate_number','vehicle_type'] }],
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    // PRD Phase 2 — PDF generation
    return success(res, { message: 'PDF invoice generation coming in Phase 2', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};