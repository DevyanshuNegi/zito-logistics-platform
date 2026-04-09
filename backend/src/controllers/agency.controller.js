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
    const where = { agency_id: req.user.id, role: 'agent' };
    if (req.query.q) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { full_name: { [Op.iLike]: `%${req.query.q}%` } },
        { email:     { [Op.iLike]: `%${req.query.q}%` } },
        { phone:     { [Op.iLike]: `%${req.query.q}%` } },
      ];
    }
    const { count, rows } = await User.findAndCountAll({
      where,
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
    const where = { agency_id: req.user.id, role: 'transporter' };
    if (req.query.q) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { full_name: { [Op.iLike]: `%${req.query.q}%` } },
        { email:     { [Op.iLike]: `%${req.query.q}%` } },
        { phone:     { [Op.iLike]: `%${req.query.q}%` } },
      ];
    }
    const { count, rows } = await User.findAndCountAll({
      where,
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
    const where = { agent_id: agentIds };
    const { Op } = require('sequelize');
    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.q) {
      where[Op.or] = [
        { reference: { [Op.iLike]: `%${req.query.q}%` } },
        { cargo_description: { [Op.iLike]: `%${req.query.q}%` } },
      ];
    }

    // Sorting
    const allowedSort = {
      created_at: ['created_at', 'DESC'],
      customer_rate: ['customer_rate', 'DESC'],
      hire_rate: ['hire_rate', 'DESC'],
      profit: ['profit', 'DESC'],
      status: ['status', 'ASC'],
    };
    const sortKey = req.query.sort_by;
    const sortDir = (req.query.sort_dir || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const order = sortKey && allowedSort[sortKey]
      ? [[allowedSort[sortKey][0], sortDir]]
      : [['created_at', 'DESC']];

    const { count, rows } = await Booking.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [
        { model: User, as: 'agent', attributes: ['id', 'full_name', 'email'] },
      ],
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getReports = async (req, res) => {
  try {
    const agents = await User.findAll({
      where: { agency_id: req.user.id, role: 'agent' },
      attributes: ['id'],
    });
    const agentIds = agents.map((a) => a.id);

    const bookings = await Booking.findAll({
      where: { agent_id: agentIds },
      attributes: ['id', 'status', 'customer_rate', 'hire_rate', 'total_expenses', 'profit'],
    });

    const byStatus = bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});

    const totals = bookings.reduce(
      (acc, b) => {
        acc.customer_rate += Number(b.customer_rate || 0);
        acc.hire_rate += Number(b.hire_rate || 0);
        acc.expenses += Number(b.total_expenses || 0);
        acc.profit += Number(b.profit || 0);
        return acc;
      },
      { customer_rate: 0, hire_rate: 0, expenses: 0, profit: 0 }
    );

    return success(res, {
      report: {
        total_bookings: bookings.length,
        by_status: byStatus,
        totals,
      },
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.exportReports = async (req, res) => {
  try {
    const agents = await User.findAll({
      where: { agency_id: req.user.id, role: 'agent' },
      attributes: ['id'],
    });
    const agentIds = agents.map((a) => a.id);
    const bookings = await Booking.findAll({
      where: { agent_id: agentIds },
      attributes: ['id', 'reference', 'agent_id', 'status', 'customer_rate', 'hire_rate', 'total_expenses', 'profit', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: Number(req.query.limit) || 5000,
    });

    const header = ['id', 'reference', 'agent_id', 'status', 'customer_rate', 'hire_rate', 'total_expenses', 'profit', 'created_at'];
    const rows = bookings.map((b) =>
      [
        b.id,
        b.reference,
        b.agent_id,
        b.status,
        b.customer_rate ?? '',
        b.hire_rate ?? '',
        b.total_expenses ?? '',
        b.profit ?? '',
        b.created_at ? new Date(b.created_at).toISOString() : '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="agency-report-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
