// src/controllers/transporter.controller.js
// PRD §5.4 — Transporter Portal
// PRD §3.6 — Transporter manages own fleet, drivers, customers, bookings

const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { generateUuidReference } = require('../utils/id');
const { autoAssignIfNeeded } = require('../services/assignment.service');
// ── Dashboard ──────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const [totalVehicles, totalDrivers, totalBookings, activeBookings] = await prisma.$transaction([
      prisma.vehicle.count({ where: { transporterId: req.user.id } }),
      prisma.user.count({ where: { transporterId: req.user.id, role: 'driver' } }),
      prisma.booking.count({ where: { transporterId: req.user.id } }),
      prisma.booking.count({ where: { transporterId: req.user.id, status: { in: ['assigned','accepted','picked_up','in_transit'] } } }),
    ]);
    return success(res, { totalVehicles, totalDrivers, totalBookings, activeBookings });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateTransporter = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return error(res, 'NOT_FOUND', 'Transporter not found', 404);

    const updates = {};
    if (req.body.full_name !== undefined) updates.full_name = req.body.full_name;
    if (req.body.phone !== undefined)     updates.phone = req.body.phone;
    if (req.body.email !== undefined)     updates.email = req.body.email;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updates
    });

    if (req.auditLog) await req.auditLog('TRANSPORTER_PROFILE_UPDATED', { user_id: user.id, updates });

    return success(res, { user: updated }, 'Profile updated');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Fleet ──────────────────────────────────────────────────────────────────
exports.getFleet = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const [count, rows] = await prisma.$transaction([
      prisma.vehicle.count({ where: { transporterId: req.user.id } }),
      prisma.vehicle.findMany({
        where: { transporterId: req.user.id },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      })
    ]);
    return success(res, rows, 'Fleet retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.addVehicle = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.create({
      data: { 
        ...req.body, 
        transporterId: req.user.id, 
        ownerUserId: req.user.id, 
        ownershipType: 'contracted',
        plateNumber: req.body.plate_number,
        vehicleType: req.body.vehicle_type
      }
    });
    if (req.auditLog) await req.auditLog('VEHICLE_ADDED', { vehicle_id: vehicle.id, by: req.user.id });
    return success(res, { vehicle }, 'Vehicle added');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: req.params.id, transporterId: req.user.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    return success(res, { vehicle });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: req.params.id, transporterId: req.user.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: req.body
    });
    return success(res, { vehicle: updated });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.retireVehicle = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: req.params.id, transporterId: req.user.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { isActive: false, deletedAt: new Date() }
    });
    return success(res, { message: 'Vehicle retired' });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

// ── Drivers ────────────────────────────────────────────────────────────────
exports.getDrivers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const [count, rows] = await prisma.$transaction([
      prisma.user.count({ where: { transporterId: req.user.id, role: 'driver', deletedAt: null } }),
      prisma.user.findMany({
        where: { transporterId: req.user.id, role: 'driver', deletedAt: null },
        take: limit,
        skip: offset,
        select: {
          id: true, full_name: true, email: true, phone: true, complianceStatus: true,
          driver: true // Assuming one-to-one relation named 'driver'
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    return success(res, rows, 'Drivers retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.inviteDriver = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name || !email || !phone) return error(res, 'VALIDATION_ERROR', 'full_name, email, phone required', 422);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already registered', 409);

    const user = await prisma.user.create({
      data: {
        full_name, email, phone,
        passwordHash:  await bcrypt.hash(phone, 12),
        role:           'driver',
        transporterId: req.user.id,
        complianceStatus: 'pending',
      }
    });
    return success(res, { user: { id: user.id, email: user.email } }, 'Driver invited');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getDriverById = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, transporterId: req.user.id },
      select: {
        id: true, full_name: true, email: true, phone: true, complianceStatus: true,
        driver: true
      }
    });
    if (!user) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateDriver = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, transporterId: req.user.id } });
    if (!user) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    await prisma.user.update({
      where: { id: user.id },
      data: { full_name: req.body.full_name, phone: req.body.phone }
    });
    return success(res, { message: 'Driver updated' });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

// ── Customers ──────────────────────────────────────────────────────────────
exports.getCustomers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = { transporterId: req.user.id, role: 'customer', deletedAt: null };

    const [count, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        select: {
          id: true, full_name: true, email: true, phone: true, complianceStatus: true, createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return success(res, rows, 'Customers retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.addCustomer = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name || !email || !phone) return error(res, 'VALIDATION_ERROR', 'full_name, email, phone required', 422);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already registered', 409);

    const user = await prisma.user.create({
      data: {
        full_name, email, phone,
        passwordHash: await bcrypt.hash(phone, 12),
        role: 'customer',
        transporterId: req.user.id,
        complianceStatus: 'approved',
      }
    });
    return success(res, { user: { id: user.id, email: user.email } }, 'Customer added');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({ 
      where: { id: req.params.id, transporterId: req.user.id },
      select: {
        id: true, full_name: true, email: true, phone: true, role: true, 
        complianceStatus: true, createdAt: true
      }
    });
    if (!user) return error(res, 'NOT_FOUND', 'Customer not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, transporterId: req.user.id } });
    if (!user) return error(res, 'NOT_FOUND', 'Customer not found', 404);
    await prisma.user.update({
      where: { id: user.id },
      data: { full_name: req.body.full_name, phone: req.body.phone }
    });
    return success(res, { message: 'Customer updated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Bookings ───────────────────────────────────────────────────────────────
exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status } = req.query;
    const where = { transporterId: req.user.id };
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
        },
      })
    ]);

    return success(res, rows, 'Bookings retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createBooking = async (req, res) => {
  try {
    const ref = generateUuidReference('ZT');
    const booking = await prisma.booking.create({
      data: {
        ...req.body, reference: ref,
        transporterId: req.user.id,
        // PRD §25.2 ownership fields
        status: 'pending',
      }
    });
    const autoResult = await autoAssignIfNeeded(booking, req.auditLog);
    return success(res, { booking, auto_assignment: autoResult }, 'Booking created');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({ 
      where: { id: req.params.id, transporterId: req.user.id },
      include: {
        customer: { select: { id: true, full_name: true, phone: true } },
        vehicle: true
      }
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.assignDriver = async (req, res) => {
  try {
    const { driver_id, vehicle_id } = req.body;
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, transporterId: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    const driver = await prisma.driver.findUnique({ where: { id: driver_id } });
    if (!driver || driver.isBlacklisted || !driver.canReceiveAssignments || !driver.isAvailable) {
      return error(res, 'DRIVER_UNAVAILABLE', 'Driver is not eligible for assignment', 400);
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        assignedDriverId: driver_id, vehicleId: vehicle_id, status: 'assigned',
      }
    });
    return success(res, { message: 'Driver assigned', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, transporterId: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled' }
    });
    return success(res, { message: 'Booking cancelled' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Finance ────────────────────────────────────────────────────────────────
exports.getFinanceSummary = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { transporterId: req.user.id, status: 'completed' },
      select: { id: true, customerRate: true, hireRate: true, profit: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    const totals = bookings.reduce(
      (acc, b) => {
        acc.total_customer_rate += Number(b.customerRate || 0);
        acc.total_hire_rate += Number(b.hireRate || 0);
        acc.total_profit += Number(b.profit || 0);
        acc.total_expenses += 0; // Placeholder for trip charges logic
        return acc;
      },
      { total_customer_rate: 0, total_hire_rate: 0, total_expenses: 0, total_profit: 0 }
    );

    return success(res, {
      summary: {
        completed_bookings: bookings.length,
        ...totals,
      },
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { transporterId: req.user.id, status: 'completed' },
      include: { customer: { select: { id: true, full_name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
      limit: Number(req.query.limit) || 200,
    });

    const invoices = bookings.map((b) => ({
      invoice_number: `TRN-${String(b.reference || b.id).slice(-8).toUpperCase()}`,
      booking_id: b.id,
      booking_reference: b.reference,
      customer: b.customer ? { id: b.customer.id, full_name: b.customer.full_name, email: b.customer.email } : null,
      customer_rate: Number(b.customerRate || 0),
      hire_rate: Number(b.hireRate || 0),
      expenses: 0,
      transporter_profit: Number(b.profit || 0),
      issued_at: b.updatedAt,
      status: 'issued',
    }));

    return success(res, { invoices });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Contracts ──────────────────────────────────────────────────────────────
exports.getContracts = async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({ 
      where: { customer: { transporterId: req.user.id } } 
    });
    return success(res, contracts);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createContract = async (req, res) => {
  try {
    const contract = await prisma.contract.create({ 
      data: { 
        ...req.body, 
        status: 'active'
      } 
    });
    return success(res, { contract }, 'Contract created');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getContractById = async (req, res) => {
  try {
    const contract = await prisma.contract.findUnique({ 
      where: { id: req.params.id },
      // include rates logic here if added to schema
    });
    if (!contract) return error(res, 'NOT_FOUND', 'Contract not found', 404);
    return success(res, { contract });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateContract = async (req, res) => {
  try {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } });
    if (!contract) return error(res, 'NOT_FOUND', 'Contract not found', 404);
    await prisma.contract.update({
      where: { id: contract.id },
      data: req.body
    });
    return success(res, { contract });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
