// src/controllers/complaint.controller.js
// PRD §18.2 — Complaint system

const { Complaint, Booking, User } = require('../models');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/helpers');
const { ROLES, ADMIN_ROLES } = require('../middleware/auth');

exports.createComplaint = async (req, res) => {
  try {
    const { category, description, booking_id } = req.body;
    if (!category || !description) {
      return error(res, 422, 'VALIDATION_ERROR', 'category and description are required');
    }

    // Optional: ensure booking belongs to user unless admin
    if (booking_id && !ADMIN_ROLES.includes(req.user.role)) {
      const booking = await Booking.findByPk(booking_id);
      if (!booking || (booking.customer_id !== req.user.id && booking.agent_id !== req.user.id && booking.transporter_id !== req.user.id)) {
        return error(res, 403, 'FORBIDDEN', 'You cannot attach this booking');
      }
    }

    const complaint = await Complaint.create({
      user_id: req.user.id,
      booking_id: booking_id || null,
      category,
      description,
      status: 'submitted',
    });

    if (req.auditLog) await req.auditLog('COMPLAINT_SUBMITTED', { complaint_id: complaint.id, user_id: req.user.id });

    return success(res, { complaint }, 201);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.listComplaints = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (!ADMIN_ROLES.includes(req.user.role)) {
      where.user_id = req.user.id;
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;

    const { rows, count } = await Complaint.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id','full_name','email','role'] },
        { model: Booking, as: 'booking', attributes: ['id','reference','status'] },
      ],
    });

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

    const complaint = await Complaint.findByPk(req.params.id);
    if (!complaint) return error(res, 404, 'NOT_FOUND', 'Complaint not found');

    await complaint.update({
      status,
      resolution_notes: resolution_notes || complaint.resolution_notes,
    });

    if (req.auditLog) await req.auditLog('COMPLAINT_STATUS_UPDATED', { complaint_id: complaint.id, status, by: req.user.id });

    return success(res, { complaint });
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};
