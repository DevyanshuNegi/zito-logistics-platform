// src/controllers/alert.controller.js
// PRD §39 — Internal Alert System
// PRD §13 — Loss Detection System escalations

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

/**
 * Fetch internal alerts for staff dashboard
 * GET /api/v1/alerts
 */
exports.getAlerts = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { severity, type, status, agency_id } = req.query;

    const where = {};
    if (severity) where.severity = severity; // 'low', 'medium', 'high', 'critical'
    if (type) where.type = type; // 'MISSING_PARCEL', 'PAYMENT_FAILURE', 'DELAYED_DELIVERY'
    if (status) where.status = status; // 'pending', 'acknowledged', 'resolved'
    
    // PRD §31 — Scope alerts by agency for branch managers
    if (agency_id) where.agencyId = agency_id;
    if (req.user.agencyId && req.user.role !== 'super_admin') {
      where.agencyId = req.user.agencyId;
    }

    const [count, rows] = await prisma.$transaction([
      prisma.internalAlert.count({ where }),
      prisma.internalAlert.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          agency: { select: { id: true, name: true } },
          acknowledgedBy: { select: { id: true, full_name: true } }
        }
      })
    ]);

    return success(res, rows, 'Internal alerts retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Acknowledge an alert to stop escalations
 * PATCH /api/v1/alerts/:id/acknowledge
 */
exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await prisma.internalAlert.findUnique({ where: { id: req.params.id } });
    if (!alert) return error(res, 'NOT_FOUND', 'Alert not found', 404);

    const updated = await prisma.internalAlert.update({
      where: { id: alert.id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedById: req.user.id
      }
    });

    if (req.auditLog) {
      await req.auditLog('ALERT_ACKNOWLEDGED', { alert_id: alert.id, by: req.user.id });
    }

    return success(res, { alert: updated }, 'Alert acknowledged');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Get high-level alert statistics for KPI cards (PRD §5.1)
 */
exports.getAlertStats = async (req, res) => {
  try {
    const stats = await prisma.internalAlert.groupBy({
      by: ['severity', 'status'],
      _count: { id: true },
      where: req.user.agencyId ? { agencyId: req.user.agencyId } : {}
    });

    return success(res, { stats });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};