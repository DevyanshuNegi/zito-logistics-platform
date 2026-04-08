// src/controllers/booking.controller.js
// PRD §6 — Booking Workflow & Status Lifecycle
// PRD §7 — Pricing Engine
// PRD §12 — /api/v1/booking/
// PRD §21 — Rating System
// PRD §23 — Cancellation Policy
// PRD §25.2 — Booking Ownership Model

const { User, Driver, Vehicle, Booking } = require('../models');
const { autoAssignIfNeeded } = require('../services/assignment.service');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { quoteFare } = require('../services/pricing.service');
const { sendBookingNotification } = require('../services/notification.service');
const { broadcastNewLoad } = require('../services/broadcast.service');

// ── Create Booking ─────────────────────────────────────────────────────────
exports.createBooking = async (req, res) => {
  try {
    const ref = 'ZT' + Date.now().toString(36).toUpperCase();
    const pricing = await quoteFare({
      vehicle_type: req.body.vehicle_type,
      distance_km:  req.body.distance_km,
      customer_id:  req.scope?.customer_id || req.body.customer_id,
      is_heavy:     req.body.is_heavy,
      is_night:     req.body.is_night,
      is_holiday:   req.body.is_holiday,
      extra_stops:  req.body.extra_stops,
      waiting_minutes: req.body.waiting_minutes,
    });

    const booking = await Booking.create({
      ...req.body,
      reference:     ref,
      status:        'pending',
      base_rate:     pricing.base_rate,
      per_km_rate:   pricing.per_km_rate,
      customer_rate: pricing.customer_rate,
      hire_rate:     pricing.hire_rate,
      profit:        pricing.profit,
      surcharges:    pricing.surcharges,
      estimated_fare: pricing.customer_rate,
      final_fare:     pricing.customer_rate,
      distance_km:    pricing.distance_km,
    });
    if (req.auditLog) await req.auditLog('BOOKING_CREATED', { booking_id: booking.id, by: req.user.id });

    const autoResult = await autoAssignIfNeeded(booking, req.auditLog);
    // If not auto-assigned, broadcast to interested drivers
    if (!autoResult.assigned) {
      broadcastNewLoad(booking).catch(console.error);
    }

    const customer = booking.customer_id ? await User.findByPk(booking.customer_id) : null;
    sendBookingNotification({ booking, customer, event: 'created' }).catch(console.error);

    return success(res, { booking, auto_assignment: autoResult }, 201);
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

    const customer = booking.customer_id ? await User.findByPk(booking.customer_id) : null;
    sendBookingNotification({ booking, customer, event: 'cancelled' }).catch(console.error);
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
    const pricing = await quoteFare({
      vehicle_type: req.query.vehicle_type,
      distance_km:  req.query.distance_km,
      customer_id:  req.scope?.customer_id || req.query.customer_id,
      is_heavy:     req.query.is_heavy,
      is_night:     req.query.is_night,
      is_holiday:   req.query.is_holiday,
      extra_stops:  req.query.extra_stops,
      waiting_minutes: req.query.waiting_minutes,
    });

    return success(res, {
      ...pricing,
      currency: 'KES',
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

    if (status === 'completed') {
      const paidStatuses = ['released', 'refunded'];
      if (!paidStatuses.includes(booking.payment_status)) {
        return error(res, 'PAYMENT_PENDING', 'Payment not confirmed; complete after payment or override via admin endpoint.', 400);
      }
    }

    const timestamps = {
      picked_up:  { picked_up_at:  new Date() },
      in_transit: { in_transit_at: new Date() },
      delivered:  { delivered_at:  new Date() },
      completed:  { completed_at:  new Date() },
    };

    await booking.update({ status, ...timestamps[status] });
    if (req.auditLog) await req.auditLog('BOOKING_STATUS_UPDATED', { booking_id: booking.id, status, by: req.user.id });

    if (['delivered', 'completed'].includes(status)) {
      const customer = booking.customer_id ? await User.findByPk(booking.customer_id) : null;
      sendBookingNotification({ booking, customer, event: 'status' }).catch(console.error);
    }
    return success(res, { message: `Status updated to ${status}`, booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
