// src/controllers/complaint.controller.js
// PRD §18.2 — Complaint system

const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { ROLES, ADMIN_ROLES } = require('../middleware/auth');

exports.createComplaint = async (req, res) => {
  try {
    const { category, description, booking_id } = req.body;
    if (!category || !description) {
      return error(res, 422, 'VALIDATION_ERROR', 'category and description are required');
    }

    // Optional: ensure booking belongs to user unless admin
    if (booking_id && !ADMIN_ROLES.includes(req.user.role)) {
      const booking = await prisma.booking.findUnique({ where: { id: booking_id } });
      if (!booking || (booking.customerId !== req.user.id && booking.transporterId !== req.user.id)) {
        return error(res, 403, 'FORBIDDEN', 'You cannot attach this booking');
      }
    }

    const complaint = await prisma.complaint.create({
      data: {
        userId: req.user.id,
        bookingId: booking_id || null,
        category,
        description,
        status: 'submitted',
      }
    });

    if (req.auditLog) await req.auditLog('COMPLAINT_SUBMITTED', { complaint_id: complaint.id, user_id: req.user.id });

    return success(res, { complaint }, 'Complaint submitted');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.listComplaints = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const where = {};
    if (!ADMIN_ROLES.includes(req.user.role)) {
      where.userId = req.user.id;
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;

    const [count, rows] = await prisma.$transaction([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, full_name: true, email: true, role: true } },
          booking: { select: { id: true, reference: true, status: true } },
        }
      })
    ]);

    return paginated(res, rows, count, page, limit);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return error(res, 403, 'FORBIDDEN', 'Admin only');
    }

    const { status, resolution_notes } = req.body;
    if (!status) return error(res, 422, 'VALIDATION_ERROR', 'status required');

    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) return error(res, 404, 'NOT_FOUND', 'Complaint not found');

    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: { status, resolutionNotes: resolution_notes || complaint.resolutionNotes }
    });

    if (req.auditLog) await req.auditLog('COMPLAINT_STATUS_UPDATED', { complaint_id: updated.id, status, by: req.user.id });

    return success(res, { complaint: updated });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};
