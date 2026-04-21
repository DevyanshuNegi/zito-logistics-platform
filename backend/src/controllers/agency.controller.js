// src/controllers/agency.controller.js
// PRD §5.6 — Agency Portal
// PRD §20 — Agency API Endpoints

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

exports.getDashboard = async (req, res) => {
  try {
    const [agents, transporters, totalBookings] = await prisma.$transaction([
      prisma.user.count({ where: { agencyId: req.user.id, role: 'agent' } }),
      prisma.user.count({ where: { agencyId: req.user.id, role: 'transporter' } }),
      prisma.booking.count({ where: { customer: { agencyId: req.user.id } } }),
    ]);
    return success(res, { agents, transporters, totalBookings });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, full_name: true, email: true, phone: true, role: true, complianceStatus: true }
    });
    return success(res, { user });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { full_name: req.body.full_name, phone: req.body.phone }
    });
    return success(res, { message: 'Profile updated' });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getAgents = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = { agencyId: req.user.id, role: 'agent', deletedAt: null };
    if (req.query.q) {
      where.OR = [
        { full_name: { contains: req.query.q, mode: 'insensitive' } },
        { email:     { contains: req.query.q, mode: 'insensitive' } },
        { phone:     { contains: req.query.q, mode: 'insensitive' } },
      ];
    }
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
    return success(res, rows, 'Agents retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.createAgent = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name || !email || !phone) return error(res, 'VALIDATION_ERROR', 'full_name, email, phone required', 422);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already registered', 409);
    
    const user = await prisma.user.create({
      data: {
        full_name, email, phone,
        password_hash: await require('bcryptjs').hash(phone, 12),
        role: 'agent',
        agencyId: req.user.id,
        complianceStatus: 'approved'
      }
    });
    return success(res, { user: { id: user.id, email: user.email } }, 'Agent created');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getAgentById = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, agencyId: req.user.id, role: 'agent' },
      select: { id: true, full_name: true, email: true, phone: true, complianceStatus: true }
    });
    if (!user) return error(res, 'NOT_FOUND', 'Agent not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateAgent = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, agencyId: req.user.id } });
    if (!user) return error(res, 'NOT_FOUND', 'Agent not found', 404);
    await prisma.user.update({
      where: { id: user.id },
      data: { full_name: req.body.full_name, phone: req.body.phone }
    });
    return success(res, { message: 'Agent updated' });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getTransporters = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = { agencyId: req.user.id, role: 'transporter', deletedAt: null };

    if (req.query.q) {
      where.OR = [
        { full_name: { contains: req.query.q, mode: 'insensitive' } },
        { email:     { contains: req.query.q, mode: 'insensitive' } },
        { phone:     { contains: req.query.q, mode: 'insensitive' } },
      ];
    }

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

    return success(res, rows, 'Transporters retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.linkTransporter = async (req, res) => {
  try {
    const { transporter_id } = req.body;
    if (!transporter_id) return error(res, 422, 'VALIDATION_ERROR', 'transporter_id required');

    await prisma.user.update({
      where: { id: transporter_id },
      data: { agencyId: req.user.id }
    });
    return success(res, null, 'Transporter linked to agency');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getTransporterById = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, agencyId: req.user.id, role: 'transporter' },
      select: { id: true, full_name: true, email: true, phone: true, complianceStatus: true }
    });
    if (!user) return error(res, 404, 'NOT_FOUND', 'Transporter not found');
    return success(res, { user });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status, q } = req.query;

    // PRD §25.1 — Agency sees all bookings from their agents
    const where = {
      agent: { agencyId: req.user.id }
    };

    if (status) where.status = status;
    if (q) {
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { cargoDescription: { contains: q, mode: 'insensitive' } },
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
          agent: { select: { id: true, full_name: true, email: true } },
          customer: { select: { id: true, full_name: true, phone: true } },
        }
      })
    ]);

    return success(res, rows, 'Bookings retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getReports = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { agent: { agencyId: req.user.id } },
      select: { status: true, customerRate: true, hireRate: true, totalExpenses: true, profit: true }
    });

    const byStatus = bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});

    const totals = bookings.reduce(
      (acc, b) => {
        acc.customer_rate += Number(b.customerRate || 0);
        acc.hire_rate += Number(b.hireRate || 0);
        acc.expenses += Number(b.totalExpenses || 0);
        acc.profit += Number(b.profit || 0);
        return acc;
      },
      { customer_rate: 0, hire_rate: 0, expenses: 0, profit: 0 }
    );

    const payload = {
      total_bookings: bookings.length,
      by_status: byStatus,
      totals,
    };

    return success(res, payload, 'Agency reports retrieved');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.exportReports = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5000, 10000);
    const bookings = await prisma.booking.findMany({
      where: { agent: { agencyId: req.user.id } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, reference: true, agentId: true, status: true, 
        customerRate: true, hireRate: true, totalExpenses: true, 
        profit: true, createdAt: true
      }
    });

    const header = ['id', 'reference', 'agent_id', 'status', 'customer_rate', 'hire_rate', 'total_expenses', 'profit', 'created_at'];
    const rows = bookings.map((b) =>
      [
        b.id,
        b.reference,
        b.agentId,
        b.status,
        b.customerRate ?? '',
        b.hireRate ?? '',
        b.totalExpenses ?? '',
        b.profit ?? '',
        b.createdAt ? b.createdAt.toISOString() : '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="agency-report-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};
