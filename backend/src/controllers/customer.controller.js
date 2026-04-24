// src/controllers/customer.controller.js
// PRD §5.2 — Customer Portal
// PRD §12 — /api/v1/customer/
// PRD §7  — Pricing Engine
// PRD §23 — Cancellation Policy
// PRD §21 — Rating System

const prisma = require('../utils/prisma');
const { success, error }   = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

// ── Dashboard ──────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const customer_id = req.user.id;
    const [total, active, completed, cancelled] = await prisma.$transaction([
      prisma.booking.count({ where: { customerId: customer_id } }),
      prisma.booking.count({ where: { customerId: customer_id, status: { in: ['assigned','accepted','picked_up','in_transit'] } } }),
      prisma.booking.count({ where: { customerId: customer_id, status: 'completed' } }),
      prisma.booking.count({ where: { customerId: customer_id, status: 'cancelled' } }),
    ]);
    return success(res, { total, active, completed, cancelled });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Profile ────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: false }
    });
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['full_name', 'phone', 'profile_photo', 'date_of_birth'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updates
    });
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
    const where = { customerId: req.user.id };
    if (status) where.status = status;

    const [count, rows] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
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

exports.getBookingById = async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, customerId: req.user.id },
      include: {
        driver: { include: { user: { select: { id: true, full_name: true, phone: true } } } },
        vehicle: true,
      },
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createBooking = async (req, res) => {
  try {
    // Delegate to booking controller so pricing/surcharges are applied consistently
    req.scope = { customer_id: req.user.id };
    req.body.customer_id = req.user.id;
    req.user.role = req.user.role || 'customer';
    return require('./booking.controller').createBooking(req, res);
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
  // Delegate to shared pricing in booking.controller (uses surcharges/contracts)
  req.scope = { customer_id: req.user.id };
  return require('./booking.controller').getPriceEstimate(req, res);
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
    const html = `
      <html><body style="font-family:Arial,sans-serif;padding:24px;">
        <h2>ZITO Invoice</h2>
        <p><strong>Reference:</strong> ${booking.reference}</p>
        <p><strong>Status:</strong> ${booking.status}</p>
        <p><strong>Payment:</strong> ${booking.payment_status}</p>
        <p><strong>Pickup:</strong> ${booking.pickup_address}</p>
        <p><strong>Delivery:</strong> ${booking.delivery_address}</p>
        <p><strong>Vehicle:</strong> ${booking.vehicle?.vehicle_type || 'N/A'} ${booking.vehicle?.plate_number ? `(${booking.vehicle.plate_number})` : ''}</p>
        <hr/>
        <p><strong>Customer Rate:</strong> KES ${booking.customer_rate || booking.final_fare || 0}</p>
        <p><strong>Issued:</strong> ${new Date().toISOString()}</p>
      </body></html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
