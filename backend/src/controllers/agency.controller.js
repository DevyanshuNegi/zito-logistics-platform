// src/controllers/agency.controller.js
// PRD §5.6 — Agency Portal
// PRD §20 — Agency API Endpoints

const { User, Booking } = require('../models');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

exports.getDashboard = async (req, res) => {
  try {
    const agency_id = req.user.id;
    const [agents, transporters, totalBookings] = await Promise.all([
      User.count({ where: { agency_id, role: 'agent' } }),
      User.count({ where: { agency_id, role: 'transporter' } }),
      Booking.count({ where: { '$customer.agency_id$': agency_id } }),
    ]);
    return success(res, { agents, transporters, totalBookings });
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

exports.getAgents = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { count, rows } = await User.findAndCountAll({
      where: { agency_id: req.user.id, role: 'agent' },
      limit, offset, attributes: { exclude: ['password_hash'] },
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createAgent = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name || !email || !phone) return error(res, 'VALIDATION_ERROR', 'full_name, email, phone required', 422);
    const existing = await User.findOne({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already registered', 409);
    const user = await User.create({ full_name, email, phone, password_hash: phone, role: 'agent', agency_id: req.user.id, compliance_status: 'approved' });
    return success(res, { user: { id: user.id, email: user.email } }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getAgentById = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, agency_id: req.user.id, role: 'agent' }, attributes: { exclude: ['password_hash'] } });
    if (!user) return error(res, 'NOT_FOUND', 'Agent not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateAgent = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, agency_id: req.user.id } });
    if (!user) return error(res, 'NOT_FOUND', 'Agent not found', 404);
    await user.update({ full_name: req.body.full_name, phone: req.body.phone });
    return success(res, { message: 'Agent updated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getTransporters = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { count, rows } = await User.findAndCountAll({
      where: { agency_id: req.user.id, role: 'transporter' },
      limit, offset, attributes: { exclude: ['password_hash'] },
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.linkTransporter = async (req, res) => {
  try {
    const { transporter_id } = req.body;
    const transporter = await User.findOne({ where: { id: transporter_id, role: 'transporter' } });
    if (!transporter) return error(res, 'NOT_FOUND', 'Transporter not found', 404);
    await transporter.update({ agency_id: req.user.id });
    return success(res, { message: 'Transporter linked to agency' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getTransporterById = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, agency_id: req.user.id, role: 'transporter' }, attributes: { exclude: ['password_hash'] } });
    if (!user) return error(res, 'NOT_FOUND', 'Transporter not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    // Agency sees bookings from all their agents
    const agents = await User.findAll({ where: { agency_id: req.user.id, role: 'agent' }, attributes: ['id'] });
    const agentIds = agents.map(a => a.id);
    const { count, rows } = await Booking.findAndCountAll({
      where: { agent_id: agentIds },
      limit, offset, order: [['created_at', 'DESC']],
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getReports = async (req, res) => {
  try {
    return success(res, { message: 'Agency reports coming in Phase 2' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.exportReports = async (req, res) => {
  try {
    return success(res, { message: 'Export coming in Phase 2' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};