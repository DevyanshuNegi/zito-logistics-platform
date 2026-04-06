// src/controllers/booking.controller.js
// PRD §6 — Booking Workflow & Status Lifecycle
// PRD §7 — Pricing Engine
// PRD §12 — /api/v1/booking/
// PRD §21 — Rating System
// PRD §23 — Cancellation Policy
// PRD §25.2 — Booking Ownership Model

const { User, Driver, Vehicle, Booking } = require('../models');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

// ── Create Booking ─────────────────────────────────────────────────────────
exports.createBooking = async (req, res) => {
  try {
    const ref = 'ZT' + Date.now().toString(36).toUpperCase();
    const booking = await Booking.create({
      ...req.body,
      reference: ref,
      status:    'pending',
    });
    if (req.auditLog) await req.auditLog('BOOKING_CREATED', { booking_id: booking.id, by: req.user.id });
    return success(res, { booking }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Get Bookings (scope-filtered) ──────────────────────────────────────────
// PRD §25.1 — API-level data filtering by role
exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status } = req.query;
    const where = {};

    // Apply scope from applyScope middleware
    if (req.scope) {
      if (req.scope.customer_id)   where.customer_id       = req.scope.customer_id;
      if (req.scope.transporter_id) where.transporter_id   = req.scope.transporter_id;
      if (req.scope.agent_id)      where.agent_id          = req.scope.agent_id;
      if (req.scope.driver_id) {
        // driver sees own trips via assigned_driver_id
        const driver = await Driver.findOne({ where: { user_id: req.scope.driver_id } });
        if (driver) where.assigned_driver_id = driver.id;
      }
    }

    if (status) where.status = status;

    const { count, rows } = await Booking.findAndCountAll({
      where, limit, offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: User,    as: 'customer', attributes: ['id','full_name','phone','email'] },
        { model: Driver,  as: 'driver',   include: [{ model: User, as: 'user', attributes: ['id','full_name','phone'] }] },
        { model: Vehicle, as: 'vehicle',  attributes: ['id','plate_number','vehicle_type'] },
      ],
    });

    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Get Booking By ID ──────────────────────────────────────────────────────
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: User,    as: 'customer', attributes: { exclude: ['password_hash'] } },
        { model: Driver,  as: 'driver',   include: [{ model: User, as: 'user', attributes: ['id','full_name','phone'] }] },
        { model: Vehicle, as: 'vehicle' },
      ],
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Cancel Booking ─────────────────────────────────────────────────────────
// PRD §23 — Cancellation Policy
exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    if (['picked_up','in_transit','delivered','completed'].includes(booking.status)) {
      return error(res, 'CANCEL_NOT_ALLOWED', 'Cannot cancel booking at this stage', 400);
    }

    await booking.update({ status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date() });
    if (req.auditLog) await req.auditLog('BOOKING_CANCELLED', { booking_id: booking.id, reason, by: req.user.id });
    return success(res, { message: 'Booking cancelled', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Rate Booking ───────────────────────────────────────────────────────────
// PRD §21.1 — Rating System
exports.rateBooking = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return error(res, 'VALIDATION_ERROR', 'Rating must be between 1 and 5', 422);
    }

    const booking = await Booking.findByPk(req.params.id);
    if (!booking || booking.status !== 'completed') {
      return error(res, 'NOT_FOUND', 'Completed booking not found', 404);
    }

    // PRD §21.1 — 48hr window
    const hours = (Date.now() - new Date(booking.completed_at).getTime()) / (1000 * 60 * 60);
    if (hours > 48) return error(res, 'RATING_WINDOW_CLOSED', '48-hour rating window has passed', 400);

    if (booking.assigned_driver_id) {
      const driver = await Driver.findByPk(booking.assigned_driver_id);
      if (driver) {
        const newTotal  = driver.total_ratings + 1;
        const newRating = ((driver.avg_rating * driver.total_ratings) + rating) / newTotal;
        await driver.update({ avg_rating: newRating.toFixed(2), total_ratings: newTotal });
      }
    }

    if (req.auditLog) await req.auditLog('BOOKING_RATED', { booking_id: booking.id, rating, by: req.user.id });
    return success(res, { message: 'Rating submitted successfully' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Price Estimate ─────────────────────────────────────────────────────────
// PRD §7 — Pricing Engine
exports.getPriceEstimate = async (req, res) => {
  try {
    const { vehicle_type, distance_km, is_night, is_holiday, is_heavy } = req.query;

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

    const surcharges = {};
    if (is_heavy   === 'true') { price *= 1.20; surcharges.heavy_load   = '20%'; }
    if (is_night   === 'true') { price *= 1.15; surcharges.night        = '15%'; }
    if (is_holiday === 'true') { price *= 1.10; surcharges.holiday      = '10%'; }

    return success(res, {
      vehicle_type,
      distance_km:    dist,
      base_rate:      rate.base,
      per_km_rate:    rate.per_km,
      surcharges,
      estimated_fare: Math.round(price),
      currency:       'KES',
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Upload POD ─────────────────────────────────────────────────────────────
// PRD §5.3 — Driver uploads Proof of Delivery
exports.uploadPOD = async (req, res) => {
  try {
    const { pod_photo_url } = req.body;
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    await booking.update({ pod_photo_url, pod_uploaded_at: new Date() });
    if (req.auditLog) await req.auditLog('POD_UPLOADED', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Proof of Delivery uploaded', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Update Status ──────────────────────────────────────────────────────────
// PRD §6 — Driver updates trip status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    const timestamps = {
      picked_up:  { picked_up_at:  new Date() },
      in_transit: { in_transit_at: new Date() },
      delivered:  { delivered_at:  new Date() },
      completed:  { completed_at:  new Date() },
    };

    await booking.update({ status, ...timestamps[status] });
    if (req.auditLog) await req.auditLog('BOOKING_STATUS_UPDATED', { booking_id: booking.id, status, by: req.user.id });
    return success(res, { message: `Status updated to ${status}`, booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};