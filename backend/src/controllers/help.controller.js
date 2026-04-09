// src/controllers/help.controller.js
// PRD §19 — On-Trip Help & SOS System

const { Op } = require('sequelize');
const { Booking, Complaint, User } = require('../models');
const { success, error } = require('../utils/response');
const { ROLES, ADMIN_ROLES } = require('../middleware/auth');
const { getIO, sendEmail } = require('../services/notification.service');

const SOS_MARKER = '[SOS_FROZEN]';

const HELP_TO_CATEGORY = {
  contact_driver: 'platform_issue',
  delay: 'platform_issue',
  driver_no_response: 'driver_behaviour',
  wrong_location: 'platform_issue',
  cancel: 'platform_issue',
  sos: 'other',
  other: 'other',
};

const ownsBooking = (booking, userId) =>
  booking &&
  [booking.customer_id, booking.agent_id, booking.transporter_id].includes(userId);

const appendSosMarker = (text = '') => {
  if (text.includes(SOS_MARKER)) return text;
  return `${text}\n${SOS_MARKER}`.trim();
};

const removeSosMarker = (text = '') =>
  text
    .split('\n')
    .filter((line) => line.trim() !== SOS_MARKER)
    .join('\n')
    .trim();

const notifyAdminsForSos = async ({ booking, actor, note, lat, lng }) => {
  const admins = await User.findAll({
    where: { role: { [Op.in]: [ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN, ROLES.FINANCE_ADMIN] } },
    attributes: ['id', 'email'],
  });

  const io = getIO && getIO();
  const payload = {
    booking_id: booking.id,
    reference: booking.reference,
    triggered_by: actor.id,
    triggered_role: actor.role,
    note: note || null,
    lat: lat ?? null,
    lng: lng ?? null,
    ts: new Date().toISOString(),
  };

  if (io) {
    io.to('role:super_admin').emit('sos:triggered', payload);
    io.to('role:operations_admin').emit('sos:triggered', payload);
    io.to('role:finance_admin').emit('sos:triggered', payload);
    io.to(`booking:${booking.id}`).emit('booking:frozen', {
      booking_id: booking.id,
      reference: booking.reference,
      reason: 'SOS_TRIGGERED',
    });
  }

  await Promise.all(
    admins
      .filter((a) => a.email)
      .map((a) =>
        sendEmail({
          to: a.email,
          subject: `SOS Alert: ${booking.reference}`,
          text: `SOS triggered on ${booking.reference}. Note: ${note || '-'} Location: ${lat || '-'}, ${lng || '-'}`,
        }).catch(() => null)
      )
  );
};

exports.createHelpRequest = async (req, res) => {
  try {
    const { action, booking_id, description } = req.body;
    if (!action || !booking_id) {
      return error(res, 'VALIDATION_ERROR', 'action and booking_id are required', 422);
    }

    if (!Object.keys(HELP_TO_CATEGORY).includes(action)) {
      return error(res, 'VALIDATION_ERROR', 'Invalid help action', 422);
    }

    const booking = await Booking.findByPk(booking_id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    if (!ADMIN_ROLES.includes(req.user.role) && !ownsBooking(booking, req.user.id)) {
      return error(res, 'FORBIDDEN', 'You cannot create help request for this booking', 403);
    }

    const complaint = await Complaint.create({
      user_id: req.user.id,
      booking_id: booking.id,
      category: HELP_TO_CATEGORY[action],
      description: description || `Help request: ${action}`,
      status: 'submitted',
    });

    if (req.auditLog) {
      await req.auditLog('HELP_REQUEST_CREATED', {
        help_action: action,
        complaint_id: complaint.id,
        booking_id: booking.id,
      });
    }

    return success(res, {
      message: 'Help request submitted',
      complaint,
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.triggerSos = async (req, res) => {
  try {
    const { booking_id, note, lat, lng } = req.body;
    if (!booking_id) return error(res, 'VALIDATION_ERROR', 'booking_id is required', 422);

    const booking = await Booking.findByPk(booking_id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    if (!ADMIN_ROLES.includes(req.user.role) && !ownsBooking(booking, req.user.id)) {
      return error(res, 'FORBIDDEN', 'You cannot trigger SOS for this booking', 403);
    }

    await Complaint.create({
      user_id: req.user.id,
      booking_id: booking.id,
      category: 'other',
      description: `SOS triggered. ${note || ''}`.trim(),
      status: 'submitted',
    });

    await booking.update({
      special_instructions: appendSosMarker(booking.special_instructions || ''),
    });

    if (req.auditLog) {
      await req.auditLog('SOS_TRIGGERED', {
        booking_id: booking.id,
        note: note || null,
        lat: lat ?? null,
        lng: lng ?? null,
      });
    }

    await notifyAdminsForSos({ booking, actor: req.user, note, lat, lng });

    return success(res, {
      message: 'SOS escalated. Booking is frozen pending admin intervention.',
      booking_id: booking.id,
      frozen: true,
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.unfreezeBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.bookingId);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    await booking.update({
      special_instructions: removeSosMarker(booking.special_instructions || ''),
    });

    if (req.auditLog) {
      await req.auditLog('SOS_UNFROZEN', {
        booking_id: booking.id,
        by: req.user.id,
      });
    }

    return success(res, { message: 'Booking unfrozen', booking_id: booking.id });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
