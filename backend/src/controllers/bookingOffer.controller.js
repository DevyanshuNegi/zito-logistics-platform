// src/controllers/bookingOffer.controller.js
// PRD §7.8–7.10 — Bidding & negotiation marketplace

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { TERMINAL_BOOKING_STATUSES } = require('../constants/bookingStatus');
const { notifyOfferResponse } = require('../services/notification.service');

// Helpers
const ensureBookingExists = async (bookingId) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error('NOT_FOUND');
  return booking;
};

exports.listOffers = async (req, res) => {
  try {
    const booking = await ensureBookingExists(req.params.id);
    const offers = await prisma.bookingOffer.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'desc' },
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
    const where = { userId: req.user.id };
    if (req.query.status) where.status = req.query.status;

    const [count, rows] = await prisma.$transaction([
      prisma.bookingOffer.count({ where }),
      prisma.bookingOffer.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true, reference: true, pickupAddress: true, deliveryAddress: true, 
              vehicleType: true, customerRate: true, status: true
            }
          }
        },
      })
    ]);

    return success(res, rows, 'Offers retrieved', require('../utils/helpers').paginatedResponse(rows, count, page, limit).meta);
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
      const driver = await prisma.driver.findUnique({ where: { id: driver_id } });
      if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    }

    if (vehicle_id) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicle_id } });
      if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    }

    const offer = await prisma.bookingOffer.create({
      data: {
        bookingId: booking.id,
        userId: req.user.id,
        role: req.user.role,
        offeredPrice: price,
        message,
        vehicleId: vehicle_id || null,
        driverId: driver_id || null,
        estimatedArrivalMins: estimated_arrival_mins || null,
        expiresAt: expires_at || null,
        status: 'pending',
      }
    });

    if (req.auditLog) await req.auditLog('OFFER_SUBMITTED', { booking_id: booking.id, offer_id: offer.id, by: req.user.id });

    const { notifyOfferCreated } = require('../services/notification.service');
    notifyOfferCreated({ offer, booking }).catch(console.error);

    return success(res, { offer }, 'Offer submitted');
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.respondToOffer = async (req, res) => {
  try {
    const booking = await ensureBookingExists(req.params.id);
    const offer = await prisma.bookingOffer.findFirst({ where: { id: req.params.offerId, bookingId: booking.id } });
    if (!offer) return error(res, 'NOT_FOUND', 'Offer not found', 404);

    const { status, rejection_reason } = req.body;
    const allowed = ['accepted', 'rejected'];
    if (!allowed.includes(status)) {
      return error(res, 'VALIDATION_ERROR', 'status must be accepted or rejected', 422);
    }

    const updatedOffer = await prisma.bookingOffer.update({
      where: { id: offer.id },
      data: {
        status,
        rejectionReason: status === 'rejected' ? (rejection_reason || null) : null,
        respondedAt: new Date(),
        respondedById: req.user.id,
      }
    });

    if (status === 'accepted') {
      // If the offer includes a driver/vehicle, assign them
      if (offer.driverId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            assignedDriverId: offer.driverId,
            vehicleId: offer.vehicleId || booking.vehicleId,
            status: 'assigned',
            assignedAt: new Date(),
          }
        });
        if (req.auditLog) await req.auditLog('BOOKING_ASSIGNED', { booking_id: booking.id, driver_id: offer.driverId, vehicle_id: offer.vehicleId, by: req.user.id, via: 'offer_accept' });
        const { notifyDriverAssignment } = require('../services/notification.service');
        notifyDriverAssignment({ booking, driver_id: offer.driverId }).catch(console.error);
      } else {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'approved' }
        });
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
