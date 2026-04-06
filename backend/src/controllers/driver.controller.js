// src/controllers/driver.controller.js
// PRD §5.3 — Driver Portal
// PRD §12 — /api/v1/driver/
// PRD §18.1 — Assignment Validation
// PRD §18.5 — GPS Tracking

const { User, Driver, Vehicle, Booking } = require('../models');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

// ── Dashboard ──────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const [total, active, completed] = await Promise.all([
      Booking.count({ where: { assigned_driver_id: driver.id } }),
      Booking.count({ where: { assigned_driver_id: driver.id, status: ['accepted','picked_up','in_transit'] } }),
      Booking.count({ where: { assigned_driver_id: driver.id, status: 'completed' } }),
    ]);

    return success(res, {
      driver: {
        id:           driver.id,
        is_available: driver.is_available,
        avg_rating:   driver.avg_rating,
        total_trips:  driver.total_trips,
      },
      trips: { total, active, completed },
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Profile ────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const driver = await Driver.findOne({
      where: { user_id: req.user.id },
      include: [
        { model: User,    as: 'user',            attributes: { exclude: ['password_hash'] } },
        { model: Vehicle, as: 'current_vehicle' },
      ],
    });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);
    return success(res, { driver });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const allowed = ['full_name', 'phone', 'profile_photo'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    await user.update(updates);
    return success(res, { message: 'Profile updated', user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Availability ───────────────────────────────────────────────────────────
exports.setAvailability = async (req, res) => {
  try {
    const { is_available } = req.body;
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);
    await driver.update({ is_available });
    return success(res, { message: `Availability set to ${is_available}`, is_available });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Trips ──────────────────────────────────────────────────────────────────
exports.getTrips = async (req, res) => {
  try {
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const { page, limit, offset } = paginate(req.query);
    const { status } = req.query;
    const where = { assigned_driver_id: driver.id };
    if (status) where.status = status;

    const { count, rows } = await Booking.findAndCountAll({
      where, limit, offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: User,    as: 'customer', attributes: ['id','full_name','phone'] },
        { model: Vehicle, as: 'vehicle',  attributes: ['id','plate_number','vehicle_type'] },
      ],
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getTripById = async (req, res) => {
  try {
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const booking = await Booking.findOne({
      where: { id: req.params.id, assigned_driver_id: driver.id },
      include: [
        { model: User,    as: 'customer', attributes: ['id','full_name','phone'] },
        { model: Vehicle, as: 'vehicle' },
      ],
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Trip not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.acceptTrip = async (req, res) => {
  try {
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const booking = await Booking.findOne({ where: { id: req.params.id, assigned_driver_id: driver.id, status: 'assigned' } });
    if (!booking) return error(res, 'NOT_FOUND', 'Trip not found or not in assigned status', 404);

    await booking.update({ status: 'accepted', accepted_at: new Date() });
    if (req.auditLog) await req.auditLog('TRIP_ACCEPTED', { booking_id: booking.id, driver_id: driver.id });
    return success(res, { message: 'Trip accepted', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.rejectTrip = async (req, res) => {
  try {
    const { reason } = req.body;
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const booking = await Booking.findOne({ where: { id: req.params.id, assigned_driver_id: driver.id, status: 'assigned' } });
    if (!booking) return error(res, 'NOT_FOUND', 'Trip not found or not in assigned status', 404);

    await booking.update({ status: 'pending', assigned_driver_id: null, rejection_reason: reason });
    if (req.auditLog) await req.auditLog('TRIP_REJECTED', { booking_id: booking.id, driver_id: driver.id, reason });
    return success(res, { message: 'Trip rejected' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// PRD §6 — Status lifecycle
exports.updateTripStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const booking = await Booking.findOne({ where: { id: req.params.id, assigned_driver_id: driver.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Trip not found', 404);

    // PRD §6 — valid transitions
    const transitions = {
      accepted:   ['picked_up'],
      picked_up:  ['in_transit'],
      in_transit: ['delivered'],
      delivered:  ['completed'],
    };

    if (!transitions[booking.status]?.includes(status)) {
      return error(res, 'INVALID_STATUS', `Cannot transition from ${booking.status} to ${status}`, 400);
    }

    const timestamps = {
      picked_up:  { picked_up_at:  new Date() },
      in_transit: { in_transit_at: new Date() },
      delivered:  { delivered_at:  new Date() },
      completed:  { completed_at:  new Date() },
    };

    await booking.update({ status, ...timestamps[status] });

    // Update driver total trips on completion
    if (status === 'completed') {
      await driver.update({ total_trips: driver.total_trips + 1 });
    }

    if (req.auditLog) await req.auditLog('TRIP_STATUS_UPDATED', { booking_id: booking.id, status, driver_id: driver.id });
    return success(res, { message: `Trip status updated to ${status}`, booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Documents ──────────────────────────────────────────────────────────────
exports.getDocuments = async (req, res) => {
  try {
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);
    return success(res, { driver });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    // Phase 2 — file upload via cloud storage
    return success(res, { message: 'Document upload coming in Phase 2' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Earnings ───────────────────────────────────────────────────────────────
// PRD — drivers on salary, paid directly, no self-tracked earnings
exports.getEarnings = async (req, res) => {
  try {
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);
    return success(res, {
      message: 'Driver earnings are managed by Admin. Contact your manager for salary details.',
      total_trips: driver.total_trips,
      avg_rating:  driver.avg_rating,
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Location ───────────────────────────────────────────────────────────────
// PRD §18.5 — GPS tracking
exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return error(res, 'VALIDATION_ERROR', 'lat and lng required', 422);

    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    await driver.update({ current_lat: lat, current_lng: lng, location_updated: new Date() });
    return success(res, { message: 'Location updated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};