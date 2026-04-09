// src/controllers/driver.controller.js
// PRD §5.3 — Driver Portal
// PRD §12 — /api/v1/driver/
// PRD §18.1 — Assignment Validation
// PRD §18.5 — GPS Tracking

const { User, Driver, Vehicle, Booking } = require('../models');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { getIO } = require('../services/notification.service');
const SOS_MARKER = '[SOS_FROZEN]';

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
    if ((booking.special_instructions || '').includes(SOS_MARKER)) {
      return error(res, 'BOOKING_FROZEN', 'Trip is frozen due to SOS. Wait for admin.', 409);
    }

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
    if ((booking.special_instructions || '').includes(SOS_MARKER)) {
      return error(res, 'BOOKING_FROZEN', 'Trip is frozen due to SOS. Wait for admin.', 409);
    }

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
    if ((booking.special_instructions || '').includes(SOS_MARKER)) {
      return error(res, 'BOOKING_FROZEN', 'Trip is frozen due to SOS. Wait for admin.', 409);
    }

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

    if (status === 'completed') {
      const paidStatuses = ['released', 'refunded'];
      if (!paidStatuses.includes(booking.payment_status)) {
        return error(res, 'PAYMENT_PENDING', 'Payment not confirmed yet; finance/admin must mark paid.', 400);
      }
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
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    // Accept both current and testing-doc field names
    const payload = ((body) => ({
      national_id_url:       body.national_id_url,
      license_url:           body.license_url || body.license_doc_url,
      license_expiry:        body.license_expiry || body.license_doc_expiry,
      kra_pin_doc_url:       body.kra_pin_doc_url,
      police_clearance_url:  body.police_clearance_url,
      police_clearance_expiry: body.police_clearance_expiry,
      medical_cert_url:      body.medical_cert_url,
      medical_expiry:        body.medical_cert_expiry,
      contract_signed:       body.contract_signed,
      oath_signed:           body.oath_signed,
      sop_signed:            body.sop_signed,
    }))(req.body);

    let compliance = await DriverCompliance.findOne({ where: { driver_id: driver.id } });
    if (!compliance) {
      compliance = await DriverCompliance.create({ driver_id: driver.id });
    }

    await compliance.update({
      ...payload,
      compliance_status: 'pending',
      status_updated_at: new Date(),
      status_updated_by: req.user.id,
    });

    await driver.update({ can_receive_assignments: false, is_available: false });
    await User.update({ compliance_status: 'pending', data_locked: false }, { where: { id: req.user.id } });

    return success(res, { message: 'Documents submitted. Awaiting admin review.', compliance });
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

    // Broadcast over socket to admins and booking participants
    const io = getIO && getIO();
    if (io) {
      const payload = { driver_id: driver.id, user_id: driver.user_id, lat, lng, updated_at: new Date() };
      io.to('global:admin').emit('driver:location', payload);
      io.to(`driver:${driver.id}`).emit('driver:location', payload);
      io.to(`user:${driver.user_id}`).emit('driver:location', payload);

      // Also push to any active booking room
      const activeBooking = await Booking.findOne({
        where: { assigned_driver_id: driver.id, status: ['assigned','accepted','picked_up','in_transit','delivered'] },
        attributes: ['id', 'customer_id', 'reference']
      });
      if (activeBooking) {
        io.to(`booking:${activeBooking.id}`).emit('driver:location', { ...payload, booking_id: activeBooking.id, reference: activeBooking.reference });
        if (activeBooking.customer_id) {
          io.to(`user:${activeBooking.customer_id}`).emit('driver:location', { ...payload, booking_id: activeBooking.id, reference: activeBooking.reference });
        }
      }
    }

    return success(res, { message: 'Location updated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Location Interest (PRD §7.10) ───────────────────────────────────────────
exports.setLocationInterest = async (req, res) => {
  try {
    const { lat, lng, radius_km = 25, note } = req.body;
    if (lat === undefined || lng === undefined) {
      return error(res, 'VALIDATION_ERROR', 'lat and lng required', 422);
    }
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    await driver.update({ location_interest: { lat: Number(lat), lng: Number(lng), radius_km: Number(radius_km), note } });
    return success(res, { message: 'Location interest saved', location_interest: driver.location_interest });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getLocationInterest = async (req, res) => {
  try {
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);
    return success(res, { location_interest: driver.location_interest });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Backhaul request (PRD §7.11) ────────────────────────────────────────────
exports.requestBackhaul = async (req, res) => {
  try {
    const { wants_backhaul = true, last_drop_lat, last_drop_lng } = req.body;
    const driver = await Driver.findOne({ where: { user_id: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    await driver.update({
      wants_backhaul: wants_backhaul === true || wants_backhaul === 'true',
      last_drop_lat: last_drop_lat || driver.last_drop_lat,
      last_drop_lng: last_drop_lng || driver.last_drop_lng,
    });
    return success(res, { message: 'Backhaul preference updated', wants_backhaul: driver.wants_backhaul });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Open Loads / Marketplace browse (PRD §5.8, §7.9) ────────────────────────
exports.getOpenLoads = async (req, res) => {
  try {
    const driver = await Driver.findOne({ where: { user_id: req.user.id }, include: [{ model: Vehicle, as: 'current_vehicle' }] });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const where = {
      status: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED],
    };
    if (driver.current_vehicle?.vehicle_type) {
      where.vehicle_type = driver.current_vehicle.vehicle_type;
    }

    const { page, limit, offset } = paginate(req.query);
    const { count, rows } = await Booking.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'reference', 'pickup_address', 'delivery_address', 'vehicle_type', 'customer_rate', 'hire_rate', 'status', 'created_at'],
    });

    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
