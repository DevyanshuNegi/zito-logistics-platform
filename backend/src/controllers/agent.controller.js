// src/controllers/agent.controller.js
// PRD §5.5 — Agent Portal
// PRD §20 — Agent API Endpoints

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { generateUuidReference } = require('../utils/id');
const { autoAssignIfNeeded } = require('../services/assignment.service');

exports.getDashboard = async (req, res) => {
  try {
    const agent_id = req.user.id;
    const [customers, totalBookings, activeBookings] = await prisma.$transaction([
      prisma.user.count({ where: { agentId: agent_id, role: 'customer' } }),
      prisma.booking.count({ where: { agentId: agent_id } }),
      prisma.booking.count({ where: { agentId: agent_id, status: { in: ['assigned','accepted','picked_up','in_transit'] } } }),
    ]);
    return success(res, { customers, totalBookings, activeBookings });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, full_name: true, email: true, phone: true, role: true, profilePhoto: true }
    });
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { full_name: req.body.full_name, phone: req.body.phone }
    });
    return success(res, { message: 'Profile updated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = { agentId: req.user.id, role: 'customer', deletedAt: null };

    const [count, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        select: { id: true, full_name: true, email: true, phone: true, complianceStatus: true },
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
        passwordHash: await require('bcryptjs').hash(phone, 12),
        role: 'customer',
        agentId: req.user.id,
        complianceStatus: 'approved'
      }
    });
    return success(res, { user: { id: user.id, email: user.email } }, 'Customer created');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, agentId: req.user.id },
      select: { id: true, full_name: true, email: true, phone: true, complianceStatus: true }
    });
    if (!user) return error(res, 'NOT_FOUND', 'Customer not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status } = req.query;
    const where = { agentId: req.user.id };
    if (status) where.status = status;

    const [count, rows] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
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
        ...req.body,
        reference: ref,
        agentId: req.user.id,
        createdByRole: req.user.role,
        createdById: req.user.id,
        status: 'pending'
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
      where: { id: req.params.id, agentId: req.user.id }
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, agentId: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled', cancellationReason: req.body.reason, cancelledAt: new Date() }
    });
    return success(res, { message: 'Booking cancelled' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
