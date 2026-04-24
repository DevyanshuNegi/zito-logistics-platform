// src/controllers/booking.controller.js
// PRD §6 — Booking Workflow & Status Lifecycle
// PRD §7 — Pricing Engine
// PRD §12 — /api/v1/booking/
// PRD §21 — Rating System
// PRD §23 — Cancellation Policy
// PRD §25.2 — Booking Ownership Model

const prisma = require('../utils/prisma');
const { autoAssignIfNeeded } = require('../services/assignment.service');
const { success, created, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { generateUuidReference } = require('../utils/id');
const { quoteFare } = require('../services/pricing.service');
const { sendBookingNotification } = require('../services/notification.service');
const { broadcastNewLoad } = require('../services/broadcast.service');
const { getOtp, delOtp } = require('../utils/redis');
const SOS_MARKER = '[SOS_FROZEN]';

// PRD §12.1 — High-value threshold
const HIGH_VALUE_THRESHOLD = Number(process.env.HIGH_VALUE_THRESHOLD_KES || 50000);

// ── Create Booking ─────────────────────────────────────────────────────────
exports.createBooking = async (req, res) => {
  try {
    const ref = generateUuidReference('ZT');
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

    const booking = await prisma.booking.create({
      data: {
        ...req.body,
        reference:     ref,
        status:        'pending',
        customerRate:  pricing.customer_rate,
        hireRate:      pricing.hire_rate,
        isHighValue:   pricing.customer_rate >= HIGH_VALUE_THRESHOLD,
        customerId:    req.scope?.customer_id || req.body.customer_id,
      }
    });
    if (req.auditLog) await req.auditLog('BOOKING_CREATED', { booking_id: booking.id, by: req.user.id });

    const autoResult = await autoAssignIfNeeded(booking, req.auditLog);
    if (!autoResult.assigned) {
      broadcastNewLoad(booking).catch(console.error);
    }

    const customer = await prisma.user.findUnique({ where: { id: booking.customerId } });
    sendBookingNotification({ booking, customer, event: 'created' }).catch(console.error);

    return created(res, { booking, auto_assignment: autoResult }, 'Booking created');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Get Bookings (scope-filtered) ──────────────────────────────────────────
// PRD §25.1 — API-level data filtering by role
exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status, search } = req.query;
    const where = {};

    // Apply scope from applyScope middleware
    if (req.scope) {
      if (req.scope.customer_id)   where.customerId       = req.scope.customer_id;
      if (req.scope.transporter_id) where.transporterId   = req.scope.transporter_id;
      if (req.scope.agent_id)      where.agentId          = req.scope.agent_id;
      if (req.scope.driver_id) {
        const driver = await prisma.driver.findUnique({ where: { userId: req.scope.driver_id } });
        if (driver) where.assignedDriverId = driver.id;
      }
    }

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { pickupAddress: { contains: search, mode: 'insensitive' } },
        { deliveryAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [count, rows] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, full_name: true, phone: true, email: true } },
          driver: { include: { user: { select: { id: true, full_name: true, phone: true } } } },
          vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
        }
      })
    ]);

    return success(res, rows, 'Bookings retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Get Booking By ID ──────────────────────────────────────────────────────
exports.getBookingById = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, full_name: true, phone: true, email: true, complianceStatus: true } },
        driver: { include: { user: { select: { id: true, full_name: true, phone: true } } } },
        vehicle: true,
        offers: { include: { transporter: { select: { id: true, name: true } } } }
      }
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
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    if (['picked_up','in_transit','delivered','completed'].includes(booking.status)) {
      return error(res, 'CANCEL_NOT_ALLOWED', 'Cannot cancel booking at this stage', 400);
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled', cancellationReason: reason, cancelledAt: new Date() }
    });

    if (req.auditLog) await req.auditLog('BOOKING_CANCELLED', { booking_id: booking.id, reason, by: req.user.id });
    return success(res, { message: 'Booking cancelled', booking: updated });
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

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.status !== 'completed') {
      return error(res, 'NOT_FOUND', 'Completed booking not found', 404);
    }

    // PRD §21.1 — 48hr window
    const hours = (Date.now() - new Date(booking.completedAt).getTime()) / (1000 * 60 * 60);
    if (hours > 48) return error(res, 'RATING_WINDOW_CLOSED', '48-hour rating window has passed', 400);

    if (booking.assignedDriverId) {
      const driver = await prisma.driver.findUnique({ where: { id: booking.assignedDriverId } });
      if (driver) {
        const newTotal  = (driver.totalRatings || 0) + 1;
        const newRating = (((Number(driver.avgRating) || 0) * (driver.totalRatings || 0)) + rating) / newTotal;
        await prisma.driver.update({ 
          where: { id: driver.id }, 
          data: { avgRating: newRating, totalRatings: newTotal } 
        });
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
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { podPhotoUrl: pod_photo_url, podUploadedAt: new Date() } });
    if (req.auditLog) await req.auditLog('POD_UPLOADED', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Proof of Delivery uploaded', booking: updated });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Update Status ──────────────────────────────────────────────────────────
// PRD §6 — Driver updates trip status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    if ((booking.specialInstructions || '').includes(SOS_MARKER)) {
      return error(res, 'BOOKING_FROZEN', 'Booking is frozen due to SOS. Admin must unfreeze first.', 409);
    }

    if (status === 'completed') {
      const paidStatuses = ['released', 'refunded'];
      if (!paidStatuses.includes(booking.paymentStatus)) {
        return error(res, 'PAYMENT_PENDING', 'Payment not confirmed; complete after payment or override via admin endpoint.', 400);
      }
    }

    // PRD §12.1 — High-value proof chain verification
    if (status === 'delivered' && booking.isHighValue && !booking.consigneeOtpVerified) {
      return error(res, 'OTP_REQUIRED', 'Consignee OTP verification required for high-value cargo delivery', 403);
    }

    const timestamps = {
      picked_up:  { pickedUpAt:  new Date() },
      in_transit: { inTransitAt: new Date() },
      delivered:  { deliveredAt:  new Date() },
      completed:  { completedAt:  new Date() },
    };

    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status, ...timestamps[status] } });
    if (req.auditLog) await req.auditLog('BOOKING_STATUS_UPDATED', { booking_id: booking.id, status, by: req.user.id });

    return success(res, { message: `Status updated to ${status}`, booking: updated });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Negotiation & Marketplace (§7.8) ─────────────────────────────────────────

exports.submitOffer = async (req, res) => {
  try {
    const { price, message, expires_at } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

    if (!booking || booking.status !== 'pending') {
      return error(res, 'INVALID_BOOKING', 'Offers can only be submitted for pending bookings.', 400);
    }

    const offer = await prisma.bookingOffer.create({
      data: {
        bookingId: booking.id,
        transporterId: req.user.id,
        offeredPrice: Number(price),
        message,
        expiresAt: expires_at ? new Date(expires_at) : null,
        status: 'submitted'
      }
    });

    if (req.auditLog) await req.auditLog('OFFER_SUBMITTED', { booking_id: booking.id, offer_id: offer.id, price });
    return created(res, { offer }, 'Offer submitted to customer');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.respondToOffer = async (req, res) => {
  try {
    const { status, counter_price, message } = req.body;
    const offer = await prisma.bookingOffer.findUnique({ 
      where: { id: req.params.offerId },
      include: { booking: true }
    });

    if (!offer) return error(res, 'NOT_FOUND', 'Offer not found', 404);
    if (offer.booking.customerId !== req.user.id) return error(res, 'FORBIDDEN', 'Only the customer can respond to offers.', 403);

    const updatedOffer = await prisma.bookingOffer.update({
      where: { id: offer.id },
      data: { 
        status, 
        counterPrice: counter_price ? Number(counter_price) : null,
        message: message || offer.message
      }
    });

    // If accepted, update booking price and transporter
    if (status === 'accepted') {
      await prisma.booking.update({
        where: { id: offer.bookingId },
        data: {
          transporterId: offer.transporterId,
          customerRate: offer.offeredPrice,
          hireRate: offer.offeredPrice * 0.8, // Fallback margin
          status: 'approved'
        }
      });
    }

    if (req.auditLog) await req.auditLog('OFFER_RESPONDED', { offer_id: offer.id, status });
    return success(res, { offer: updatedOffer }, `Offer ${status} successfully`);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Generate Waybill (LR) ──────────────────────────────────────────────────
// PRD §12.2 — Mandatory LR/Waybill generation
exports.getWaybill = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        driver: { include: { user: true } },
        vehicle: true
      }
    });

    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    // Implementation uses PDFKit for professional document generation
    try {
      const PDFDocument = require('pdfkit');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="WAYBILL-${booking.reference}.pdf"`);
      
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);
      
      doc.fontSize(20).text('ZITO LOGISTICS — WAYBILL', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Reference: ${booking.reference}`, { weight: 'bold' });
      doc.text(`Date: ${new Date(booking.createdAt).toLocaleDateString()}`);
      doc.moveDown();
      
      doc.text('SHIPPER DETAILS:', { underline: true });
      doc.text(`Name: ${booking.customer?.full_name || 'N/A'}`);
      doc.text(`Phone: ${booking.customer?.phone || 'N/A'}`);
      doc.moveDown();
      
      doc.text('CARRIER DETAILS:', { underline: true });
      doc.text(`Driver: ${booking.driver?.user?.full_name || 'N/A'}`);
      doc.text(`Vehicle: ${booking.vehicle?.plateNumber || 'N/A'} (${booking.vehicle?.vehicleType || ''})`);
      doc.moveDown();
      
      doc.text('ROUTE:', { underline: true });
      doc.text(`From: ${booking.pickupAddress}`);
      doc.text(`To: ${booking.deliveryAddress}`);
      
      doc.end();
    } catch (pdfErr) {
      return error(res, 'PDF_GEN_FAILED', 'Could not generate Waybill PDF.', 500);
    }
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.verifyConsigneeOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    const stored = await getOtp(booking.customerId, 'delivery');
    if (!stored || stored.otp !== String(otp).trim()) {
      return error(res, 'INVALID_OTP', 'The consignee OTP is incorrect or has expired.', 401);
    }

    await delOtp(booking.customerId, 'delivery');

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { consigneeOtpVerified: true, consigneeOtpVerifiedAt: new Date() }
    });

    if (req.auditLog) await req.auditLog('CONSIGNEE_OTP_VERIFIED', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Consignee OTP verified successfully', booking: updated });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
