// src/controllers/bookingOffer.controller.js
// PRD §7.8–7.10 — Bidding & negotiation marketplace

const { Booking, BookingOffer, Driver, Vehicle } = require('../models');
const { success, error } = require('../utils/response');
const { TERMINAL_BOOKING_STATUSES } = require('../constants/bookingStatus');
const { notifyOfferResponse } = require('../services/notification.service');

// Helpers
const ensureBookingExists = async (bookingId) => {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw new Error('NOT_FOUND');
  return booking;
};

exports.listOffers = async (req, res) => {
  try {
    const booking = await ensureBookingExists(req.params.id);
    const offers = await BookingOffer.findAll({
      where: { booking_id: booking.id },
      order: [['created_at', 'DESC']],
    });
    return success(res, { booking_id: booking.id, offers });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// GET /api/v1/offers/mine
// PRD §7.9 — Drivers/Transporters/Agents view their submitted bids
exports.listMyOffers = async (req, res) => {
  try {
    const { page, limit, offset } = require('../utils/helpers').paginate(req.query);
    const where = { user_id: req.user.id };
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await BookingOffer.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: ['id', 'reference', 'pickup_address', 'delivery_address', 'vehicle_type', 'customer_rate', 'status'],
        },
      ],
    });

    return success(res, rows, 200, require('../utils/helpers').paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createOffer = async (req, res) => {
  try {
    const booking = await ensureBookingExists(req.params.id);

    if (TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
      return error(res, 'BOOKING_CLOSED', 'Cannot bid on a closed booking', 400);
    }

    const { price, message, vehicle_id, driver_id, estimated_arrival_mins, expires_at } = req.body;
    if (!price) {
      return error(res, 'VALIDATION_ERROR', 'price is required', 422);
    }

    // Optional sanity: if driver_id provided, ensure driver exists
    if (driver_id) {
      const driver = await Driver.findByPk(driver_id);
      if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    }

    if (vehicle_id) {
      const vehicle = await Vehicle.findByPk(vehicle_id);
      if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    }

    const offer = await BookingOffer.create({
      booking_id: booking.id,
      user_id: req.user.id,
      role: req.user.role,
      price,
      message,
      vehicle_id: vehicle_id || null,
      driver_id: driver_id || null,
      estimated_arrival_mins: estimated_arrival_mins || null,
      expires_at: expires_at || null,
      status: 'pending',
    });

    if (req.auditLog) await req.auditLog('OFFER_SUBMITTED', { booking_id: booking.id, offer_id: offer.id, by: req.user.id });

    const { notifyOfferCreated } = require('../services/notification.service');
    notifyOfferCreated({ offer, booking }).catch(console.error);

    return success(res, { offer }, 201);
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.respondToOffer = async (req, res) => {
  try {
    const booking = await ensureBookingExists(req.params.id);
    const offer = await BookingOffer.findOne({ where: { id: req.params.offerId, booking_id: booking.id } });
    if (!offer) return error(res, 'NOT_FOUND', 'Offer not found', 404);

    const { status, rejection_reason } = req.body;
    const allowed = ['accepted', 'rejected'];
    if (!allowed.includes(status)) {
      return error(res, 'VALIDATION_ERROR', 'status must be accepted or rejected', 422);
    }

    await offer.update({
      status,
      rejection_reason: status === 'rejected' ? (rejection_reason || null) : null,
      responded_at: new Date(),
      responded_by: req.user.id,
    });

    if (status === 'accepted') {
      // If the offer includes a driver/vehicle, assign them
      if (offer.driver_id) {
        await booking.update({
          assigned_driver_id: offer.driver_id,
          vehicle_id: offer.vehicle_id || booking.vehicle_id,
          status: 'assigned',
          assigned_at: new Date(),
        });
        if (req.auditLog) await req.auditLog('BOOKING_ASSIGNED', { booking_id: booking.id, driver_id: offer.driver_id, vehicle_id: offer.vehicle_id, by: req.user.id, via: 'offer_accept' });
        const { notifyDriverAssignment } = require('../services/notification.service');
        notifyDriverAssignment({ booking, driver_id: offer.driver_id }).catch(console.error);
      } else {
        await booking.update({ status: 'approved' });
      }
    }

    if (req.auditLog) await req.auditLog('OFFER_RESPONDED', {
      booking_id: booking.id,
      offer_id: offer.id,
      action: status,
      by: req.user.id,
    });

    notifyOfferResponse({ offer, booking, status }).catch(console.error);

    return success(res, { offer, booking });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
