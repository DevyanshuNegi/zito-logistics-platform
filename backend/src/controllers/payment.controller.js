// src/controllers/payment.controller.js
// PRD §25.6 — Payment Hold & Release Lifecycle
// PRD §9 — M-Pesa Phase 2

const { Booking } = require('../models');
const { success, error } = require('../utils/response');

exports.getPayments    = async (req, res) => success(res, { message: 'Payment history — Phase 2' });
exports.getPaymentById = async (req, res) => success(res, { message: 'Payment detail — Phase 2' });
exports.initiatePayment= async (req, res) => success(res, { message: 'Payment initiation — Phase 2' });
exports.mpesaStkPush   = async (req, res) => success(res, { message: 'M-Pesa STK Push — Phase 2' });
exports.mpesaCallback  = async (req, res) => res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
exports.generateInvoice= async (req, res) => success(res, { message: 'Invoice PDF — Phase 2' });

exports.releasePayment = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await booking.update({ payment_status: 'released' });
    if (req.auditLog) await req.auditLog('PAYMENT_RELEASED', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Payment released' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await booking.update({ payment_status: 'refunded' });
    if (req.auditLog) await req.auditLog('PAYMENT_REFUNDED', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Payment refunded' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.freezePayment = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await booking.update({ payment_status: 'frozen' });
    if (req.auditLog) await req.auditLog('PAYMENT_FROZEN', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Payment frozen pending dispute resolution' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};