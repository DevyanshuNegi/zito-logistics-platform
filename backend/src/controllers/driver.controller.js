// src/controllers/driver.controller.js
// PRD §5.3 — Driver Portal
// PRD §12 — /api/v1/driver/
// PRD §18.1 — Assignment Validation
// PRD §18.5 — GPS Tracking

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { getIO } = require('../services/notification.service');
const barcodeService = require('../services/barcode.service');
const alertService = require('../services/alert.service');

const SOS_MARKER = '[SOS_FROZEN]';

// ── Dashboard ──────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const [total, active, completed] = await prisma.$transaction([
      prisma.booking.count({ where: { assignedDriverId: driver.id } }),
      prisma.booking.count({ where: { assignedDriverId: driver.id, status: { in: ['accepted','picked_up','in_transit'] } } }),
      prisma.booking.count({ where: { assignedDriverId: driver.id, status: 'completed' } }),
    ]);

    return success(res, {
      driver: {
        id:           driver.id,
        is_available: driver.isAvailable,
        avg_rating:   driver.avgRating,
        total_trips:  driver.totalTrips,
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
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { id: true, full_name: true, email: true, phone: true, role: true, profilePhoto: true } },
        currentVehicle: true,
      }
    });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);
    return success(res, { driver });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['full_name', 'phone', 'profile_photo'];
    const updates = {};
    if (req.body.full_name !== undefined)     updates.full_name = req.body.full_name;
    if (req.body.phone !== undefined)         updates.phone = req.body.phone;
    if (req.body.profile_photo !== undefined) updates.profilePhoto = req.body.profile_photo;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updates
    });

    return success(res, { user: updated }, 'Profile updated');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Availability ───────────────────────────────────────────────────────────
exports.setAvailability = async (req, res) => {
  try {
    const { is_available } = req.body;
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    // PRD §44.1 — Driver must START SHIFT before going online
    if (is_available === true || is_available === 'true') {
      const activeShift = await prisma.driverShift.findFirst({
        where: { driverId: driver.id, endTime: null }
      });
      if (!activeShift) {
        return error(res, 'SHIFT_REQUIRED', 'You must start a shift before going online.', 403);
      }
    }

    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable: !!is_available }
    });
    return success(res, { is_available: updated.isAvailable }, `Availability set to ${updated.isAvailable}`);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.startShift = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const activeShift = await prisma.driverShift.findFirst({
      where: { driverId: driver.id, endTime: null }
    });
    if (activeShift) return error(res, 'SHIFT_ALREADY_ACTIVE', 'You already have an active shift.', 400);

    const shift = await prisma.driverShift.create({
      data: {
        driverId: driver.id,
        startTime: new Date(),
        attendanceStatus: 'present'
      }
    });

    if (req.auditLog) await req.auditLog('SHIFT_STARTED', { shift_id: shift.id, driver_id: driver.id });
    return success(res, { shift }, 'Shift started successfully. You can now toggle availability.');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.endShift = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const activeShift = await prisma.driverShift.findFirst({
      where: { driverId: driver.id, endTime: null }
    });
    if (!activeShift) return error(res, 'NO_ACTIVE_SHIFT', 'No active shift found.', 400);

    const endTime = new Date();
    const startTime = new Date(activeShift.startTime);

    // PRD §44.1 — Calculate total, trip, and idle hours
    const completedBookings = await prisma.booking.findMany({
      where: {
        assignedDriverId: driver.id,
        status: 'completed',
        completedAt: { gte: startTime, lte: endTime },
        pickedUpAt: { not: null }
      }
    });

    // Trip hours: Sum of (completedAt - pickedUpAt) for trips completed during this shift
    const tripMs = completedBookings.reduce((sum, b) => {
      return sum + (new Date(b.completedAt) - new Date(b.pickedUpAt));
    }, 0);

    const totalMs = endTime - startTime;
    const totalHours = totalMs / (1000 * 60 * 60);
    const tripHours = tripMs / (1000 * 60 * 60);
    const idleHours = Math.max(0, totalHours - tripHours);

    const shift = await prisma.driverShift.update({
      where: { id: activeShift.id },
      data: { 
        endTime,
        totalHours: Number(totalHours.toFixed(2)),
        tripHours: Number(tripHours.toFixed(2)),
        idleHours: Number(idleHours.toFixed(2)),
        attendanceStatus: 'present'
      }
    });

    // PRD §44.1 — Automatically go offline when shift ends
    await prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable: false }
    });

    if (req.auditLog) await req.auditLog('SHIFT_ENDED', { shift_id: shift.id, driver_id: driver.id });
    return success(res, { shift }, 'Shift ended. You are now offline.');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Trips ──────────────────────────────────────────────────────────────────
exports.getTrips = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const { page, limit, offset } = paginate(req.query);
    const { status } = req.query;
    const where = { assignedDriverId: driver.id };
    if (status) where.status = status;

    const [count, rows] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, full_name: true, phone: true } },
          vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
        }
      })
    ]);

    return success(res, rows, 'Trips retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getTripById = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, full_name: true, phone: true } },
        vehicle: true,
      }
    });
    if (!booking || booking.assignedDriverId !== driver.id) return error(res, 'NOT_FOUND', 'Trip not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.acceptTrip = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.assignedDriverId !== driver.id || booking.status !== 'assigned') {
      return error(res, 'NOT_FOUND', 'Trip not found or not in assigned status', 404);
    }
    if ((booking.specialInstructions || '').includes(SOS_MARKER)) {
      return error(res, 'BOOKING_FROZEN', 'Trip is frozen due to SOS. Wait for admin.', 409);
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'accepted', acceptedAt: new Date() }
    });
    if (req.auditLog) await req.auditLog('TRIP_ACCEPTED', { booking_id: booking.id, driver_id: driver.id });
    return success(res, { booking: updated }, 'Trip accepted');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.rejectTrip = async (req, res) => {
  try {
    const { reason } = req.body;
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.assignedDriverId !== driver.id || booking.status !== 'assigned') {
      return error(res, 'NOT_FOUND', 'Trip not found or not in assigned status', 404);
    }
    if ((booking.specialInstructions || '').includes(SOS_MARKER)) {
      return error(res, 'BOOKING_FROZEN', 'Trip is frozen due to SOS. Wait for admin.', 409);
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'pending', assignedDriverId: null, rejectionReason: reason }
    });
    if (req.auditLog) await req.auditLog('TRIP_REJECTED', { booking_id: booking.id, driver_id: driver.id, reason });
    return success(res, null, 'Trip rejected');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * PRD §44.4 — Vehicle Breakdown Reporting
 * Allows driver to report a breakdown and triggers critical escalation.
 */
exports.reportBreakdown = async (req, res) => {
  try {
    const { booking_id, lat, lng, note } = req.body;
    if (!booking_id) return error(res, 'VALIDATION_ERROR', 'booking_id is required', 422);

    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    const booking = await prisma.booking.findUnique({ where: { id: booking_id } });

    if (!booking || booking.assignedDriverId !== driver.id) {
      return error(res, 'NOT_FOUND', 'Active trip not found', 404);
    }

    // PRD §44.4 — Automatic escalation to agency via Internal Alert System
    const alert = await alertService.createAlert({
      type: 'VEHICLE_BREAKDOWN',
      severity: 'critical',
      message: `CRITICAL: Breakdown reported for trip ${booking.reference} by ${req.user.full_name}.`,
      agencyId: booking.agencyId,
      entityType: 'booking',
      entityId: booking.id,
      metadata: { lat, lng, note, reported_at: new Date() }
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        specialInstructions: `${booking.specialInstructions || ''}\n[BREAKDOWN_REPORTED] at ${lat},${lng}. Note: ${note || 'No details'}`
      }
    });

    if (req.auditLog) await req.auditLog('BREAKDOWN_REPORTED', { booking_id: booking.id, alert_id: alert.id });
    return success(res, { alert_id: alert.id }, 'Breakdown reported and operations team notified.');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// PRD §6 — Status lifecycle
exports.updateTripStatus = async (req, res) => {
  try {
    const { status, barcode, pod_photo_url, lat, lng, notes } = req.body;
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking || booking.assignedDriverId !== driver.id) return error(res, 'NOT_FOUND', 'Trip not found', 404);
    if ((booking.specialInstructions || '').includes(SOS_MARKER)) {
      return error(res, 'BOOKING_FROZEN', 'Trip is frozen due to SOS. Wait for admin.', 409);
    }

    // PRD §12 — No Scan = No Movement Enforcement
    if ((status === 'picked_up' || status === 'delivered') && !barcode) {
      return error(res, 'SCAN_REQUIRED', `A barcode scan is mandatory to mark the trip as ${status.replace('_', ' ')}.`, 422);
    }

    if (barcode) {
      await barcodeService.validateAndProcessScan({
        barcode,
        scanType: status === 'picked_up' ? barcodeService.SCAN_TYPES.PICKUP : barcodeService.SCAN_TYPES.DELIVERY,
        userId: req.user.id,
        bookingId: booking.id,
        lat, lng
      });
    }

    // PRD §12.1 — High-value proof chain check
    if (status === 'delivered' && booking.isHighValue && !booking.consigneeOtpVerified) {
      return error(res, 'OTP_REQUIRED', 'Consignee OTP verification required for high-value cargo', 403);
    }

    // PRD §6 — valid transitions
    const transitions = {
      accepted:   ['picked_up'],
      picked_up:  ['in_transit'],
      in_transit: ['arrived_at_destination'],
      arrived_at_destination: ['delivered'],
      delivered:  ['completed'],
    };

    if (!transitions[booking.status]?.includes(status)) {
      return error(res, 'INVALID_STATUS', `Cannot transition from ${booking.status} to ${status}`, 400);
    }

    // PRD §12.1 — If arrived at destination and cargo is high-value, trigger OTP send
    if (status === 'arrived_at_destination' && booking.isHighValue) {
      const otpController = require('./otp.controller');
      // We send the OTP to the customer associated with the booking
      await otpController.sendOtp({ body: { user_id: booking.customerId, type: 'delivery' } }, { status: () => ({ json: () => {} }) });
    }

    if (status === 'completed') {
      const paidStatuses = ['released', 'refunded'];
      if (!paidStatuses.includes(booking.paymentStatus)) {
        return error(res, 'PAYMENT_PENDING', 'Payment not confirmed yet; finance/admin must mark paid.', 400);
      }
    }

    const timestamps = {
      picked_up:  { pickedUpAt:  new Date(), pickupLat: lat ? Number(lat) : null, pickupLng: lng ? Number(lng) : null },
      in_transit: { inTransitAt: new Date() },
      delivered:  { deliveredAt:  new Date(), podPhotoUrl: pod_photo_url, deliveryLat: lat ? Number(lat) : null, deliveryLng: lng ? Number(lng) : null },
      completed:  { completedAt:  new Date() },
    };

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status, ...timestamps[status], specialInstructions: notes ? `${booking.specialInstructions || ''}\nNote: ${notes}` : booking.specialInstructions }
    });

    // Update driver total trips on completion
    if (status === 'completed') {
      await prisma.driver.update({
        where: { id: driver.id },
        data: { totalTrips: driver.totalTrips + 1 }
      });
    }

    if (req.auditLog) await req.auditLog('TRIP_STATUS_UPDATED', { booking_id: booking.id, status, driver_id: driver.id });
    return success(res, { booking: updated }, `Trip status updated to ${status}`);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Documents ──────────────────────────────────────────────────────────────
exports.getDocuments = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id },
      include: { compliance: true }
    });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);
    return success(res, { driver, compliance: driver.compliance });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const payload = {
      nationalIdUrl:       req.body.national_id_url,
      licenseUrl:           req.body.license_url || req.body.license_doc_url,
      licenseExpiry:        req.body.license_expiry ? new Date(req.body.license_expiry) : null,
      kraPinDocUrl:       req.body.kra_pin_doc_url,
      policeClearanceUrl:  req.body.police_clearance_url,
      policeClearanceExpiry: req.body.police_clearance_expiry ? new Date(req.body.police_clearance_expiry) : null,
      medicalCertUrl:      req.body.medical_cert_url,
      medicalExpiry:        req.body.medical_expiry ? new Date(req.body.medical_expiry) : null,
      contractSigned:       req.body.contract_signed,
      oathSigned:           req.body.oath_signed,
      sopSigned:            req.body.sop_signed,
    };

    const updatedCompliance = await prisma.driverCompliance.upsert({
      where: { driverId: driver.id },
      update: { ...payload, complianceStatus: 'pending', statusUpdatedAt: new Date(), statusUpdatedBy: req.user.id },
      create: { driverId: driver.id, ...payload, complianceStatus: 'pending', statusUpdatedAt: new Date(), statusUpdatedBy: req.user.id }
    });

    await prisma.driver.update({
      where: { id: driver.id },
      data: { canReceiveAssignments: false, isAvailable: false }
    });
    await prisma.user.update({
      where: { id: req.user.id },
      data: { complianceStatus: 'pending', dataLocked: false }
    });

    return success(res, { compliance: updatedCompliance }, 'Documents submitted. Awaiting admin review.');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Earnings ───────────────────────────────────────────────────────────────
// PRD — drivers are salary-backed, but the portal still exposes wallet visibility
exports.getEarnings = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const approvedExpenses = await prisma.tripCharge.findMany({
      where: {
        driverId: driver.id,
        chargeType: 'driver_expense',
        status: 'approved',
      },
      select: { amount: true },
    });

    const totalExpenses = approvedExpenses.reduce(
      (sum, charge) => sum + Number(charge.amount || 0),
      0,
    );

    return success(res, {
      total_trips: driver.totalTrips,
      avg_rating:  driver.avgRating,
      total_earnings: Number(driver.walletBalance || 0),
      total_expenses: totalExpenses,
      pending_payout: Number(driver.pendingPayout || 0),
      last_payout_at: driver.lastPayoutAt,
    }, 'Wallet visibility is available here. Final payouts are still approved by Admin.');
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

    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    await prisma.driver.update({
      where: { id: driver.id },
      data: {
        currentLat: Number(lat),
        currentLng: Number(lng),
        locationUpdated: new Date()
      }
    });

    // Broadcast over socket to admins and booking participants
    const io = getIO && getIO();
    if (io) {
      const payload = { driver_id: driver.id, user_id: req.user.id, lat, lng, updated_at: new Date() };
      io.to('global:admin').emit('driver:location', payload);
      io.to(`driver:${driver.id}`).emit('driver:location', payload);
      io.to(`user:${driver.user_id}`).emit('driver:location', payload);

      // Also push to any active booking room
      const activeBooking = await prisma.booking.findFirst({
        where: { 
          assignedDriverId: driver.id, 
          status: { in: ['assigned','accepted','picked_up','in_transit','delivered'] } 
        },
        select: { id: true, customerId: true, reference: true }
      });
      if (activeBooking) {
        io.to(`booking:${activeBooking.id}`).emit('driver:location', { ...payload, booking_id: activeBooking.id, reference: activeBooking.reference });
        if (activeBooking.customerId) {
          io.to(`user:${activeBooking.customerId}`).emit('driver:location', { ...payload, booking_id: activeBooking.id, reference: activeBooking.reference });
        }
      }
    }

    return success(res, null, 'Location updated');
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
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: { locationInterest: { lat: Number(lat), lng: Number(lng), radius_km: Number(radius_km), note } }
    });

    if (req.auditLog) await req.auditLog('DRIVER_LOCATION_INTEREST_SET', { driver_id: driver.id, interest: { lat, lng, radius_km } });
    return success(res, { location_interest: updated.locationInterest }, 'Location interest saved');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getLocationInterest = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);
    return success(res, { location_interest: driver.locationInterest });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Backhaul request (PRD §7.11) ────────────────────────────────────────────
exports.requestBackhaul = async (req, res) => {
  try {
    const { wants_backhaul = true, last_drop_lat, last_drop_lng } = req.body;
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: {
        wantsBackhaul: wants_backhaul === true || wants_backhaul === 'true',
        lastDropLat: last_drop_lat || driver.lastDropLat,
        lastDropLng: last_drop_lng || driver.lastDropLng,
      }
    });
    if (req.auditLog) await req.auditLog('DRIVER_BACKHAUL_REQUESTED', { driver_id: driver.id, wants_backhaul });
    return success(res, { wants_backhaul: updated.wantsBackhaul }, 'Backhaul preference updated');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Open Loads / Marketplace browse (PRD §5.8, §7.9) ────────────────────────
exports.getOpenLoads = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ 
      where: { userId: req.user.id }, 
      include: { currentVehicle: true } 
    });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver profile not found', 404);

    const where = {
      status: { in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED] },
    };
    if (driver.currentVehicle?.vehicleType) {
      where.vehicleType = driver.currentVehicle.vehicleType;
    }

    const { page, limit, offset } = paginate(req.query);
    const [count, rows] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, reference: true, pickupAddress: true, deliveryAddress: true, 
          vehicleType: true, customerRate: true, hireRate: true, status: true, createdAt: true
        }
      })
    ]);

    return success(res, rows, 'Open loads retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
