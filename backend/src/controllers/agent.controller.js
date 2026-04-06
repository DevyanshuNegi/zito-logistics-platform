// src/controllers/agent.controller.js
// PRD §5.5 — Agent Portal
// PRD §20 — Agent API Endpoints

const { User, Booking } = require('../models');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

exports.getDashboard = async (req, res) => {
  try {
    const agent_id = req.user.id;
    const [customers, totalBookings, activeBookings] = await Promise.all([
      User.count({ where: { agent_id, role: 'customer' } }),
      Booking.count({ where: { agent_id } }),
      Booking.count({ where: { agent_id, status: ['assigned','accepted','picked_up','in_transit'] } }),
    ]);
    return success(res, { customers, totalBookings, activeBookings });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password_hash'] } });
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    await user.update({ full_name: req.body.full_name, phone: req.body.phone });
    return success(res, { message: 'Profile updated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { count, rows } = await User.findAndCountAll({
      where: { agent_id: req.user.id, role: 'customer' },
      limit, offset, attributes: { exclude: ['password_hash'] },
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.addCustomer = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name || !email || !phone) return error(res, 'VALIDATION_ERROR', 'full_name, email, phone required', 422);
    const existing = await User.findOne({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already registered', 409);
    const user = await User.create({ full_name, email, phone, password_hash: phone, role: 'customer', agent_id: req.user.id, compliance_status: 'approved' });
    return success(res, { user: { id: user.id, email: user.email } }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, agent_id: req.user.id }, attributes: { exclude: ['password_hash'] } });
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
    const where = { agent_id: req.user.id };
    if (status) where.status = status;
    const { count, rows } = await Booking.findAndCountAll({ where, limit, offset, order: [['created_at', 'DESC']] });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createBooking = async (req, res) => {
  try {
    const ref = 'ZT' + Date.now().toString(36).toUpperCase();
    const booking = await Booking.create({ ...req.body, reference: ref, agent_id: req.user.id, created_by_role: req.user.role, created_by_id: req.user.id, status: 'pending' });
    return success(res, { booking }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({ where: { id: req.params.id, agent_id: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ where: { id: req.params.id, agent_id: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await booking.update({ status: 'cancelled', cancellation_reason: req.body.reason, cancelled_at: new Date() });
    return success(res, { message: 'Booking cancelled' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};