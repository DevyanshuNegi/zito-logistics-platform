// src/controllers/payment.controller.js
// PRD Â§25.6 â€” Payment Hold & Release Lifecycle
// PRD Â§9 â€” M-Pesa Phase 2 (sandbox / mock friendly)

const { v4: uuid } = require('uuid');
const { Booking, Driver, TripCharge, Payment, User } = require('../models');
const { success, error } = require('../utils/response');
const { sendPaymentNotification } = require('../services/notification.service');

const ensureBooking = async (id) => {
  const booking = await Booking.findByPk(id);
  if (!booking) throw new Error('NOT_FOUND');
  return booking;
};

const loadCustomer = async (booking) => {
  if (!booking?.customer_id) return null;
  return User.findByPk(booking.customer_id);
};

const creditDriver = async (booking) => {
  if (booking.payment_status === 'released') return;
  if (!booking.assigned_driver_id) return;
  const driver = await Driver.findByPk(booking.assigned_driver_id);
  if (!driver) return;

  // Sum approved driver_expense charges
  const driverExpenses = await TripCharge.findAll({
    where: { trip_id: booking.id, status: 'approved', charge_type: 'driver_expense' },
    attributes: ['amount'],
  });
  const expenseSum = driverExpenses.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const hire = Number(booking.hire_rate || 0);
  const credit = hire + expenseSum;
  const newWallet  = Number(driver.wallet_balance || 0) + credit;
  const newPending = Math.max(0, Number(driver.pending_payout || 0) + credit);
  await driver.update({ wallet_balance: newWallet, pending_payout: newPending, last_payout_at: new Date() });
};

exports.getPayments = async (req, res) => {
  const payments = await Payment.findAll({
    order: [['created_at', 'DESC']],
    include: [{ model: Booking, as: 'booking', attributes: ['reference', 'customer_rate', 'hire_rate', 'payment_status'] }],
    limit: Number(req.query.limit) || 500,
  });
  return success(res, { payments });
};

exports.createPayment = async (req, res) => {
  try {
    const {
      booking_id,
      amount,
      amount_kes,
      method,
      provider,
      status = 'paid',
      mpesa_ref,
      reference,
      notes,
    } = req.body;

    if (!booking_id) {
      return error(res, 'VALIDATION_ERROR', 'booking_id is required', 422);
    }

    const booking = await ensureBooking(booking_id);
    const normalizedStatus = ['pending', 'held', 'paid', 'failed', 'refunded'].includes(status)
      ? status
      : 'paid';
    const normalizedProvider = {
      mpesa: 'mpesa',
      credit: 'bank',
      bank: 'bank',
      cash: 'cash',
      card: 'card',
      mock: 'mock',
    }[provider || method] || 'mock';

    const payment = await Payment.create({
      booking_id: booking.id,
      provider: normalizedProvider,
      amount: Number(amount_kes ?? amount ?? booking.customer_rate ?? booking.final_fare ?? 0),
      status: normalizedStatus,
      reference: mpesa_ref || reference || `FIN-${uuid().slice(0, 8).toUpperCase()}`,
      metadata: {
        notes: notes || null,
        recorded_by: req.user.id,
        recorded_by_role: req.user.role,
        source: 'finance_manual',
      },
    });

    if (normalizedStatus === 'paid') {
      await creditDriver(booking);
      await booking.update({ payment_status: 'released' });
      const customer = await loadCustomer(booking);
      sendPaymentNotification({ booking, customer, status: 'released' }).catch(console.error);
    } else if (normalizedStatus === 'held') {
      await booking.update({ payment_status: 'held' });
    } else if (normalizedStatus === 'refunded') {
      await booking.update({ payment_status: 'refunded' });
    } else {
      await booking.update({ payment_status: 'pending' });
    }

    if (req.auditLog) {
      await req.auditLog('PAYMENT_RECORDED', {
        booking_id: booking.id,
        payment_id: payment.id,
        status: normalizedStatus,
        provider: normalizedProvider,
        by: req.user.id,
      });
    }

    return success(res, {
      payment,
      booking_payment_status: booking.payment_status,
    }, 'Payment recorded successfully');
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getPaymentById = async (req, res) => {
  const payment = await Payment.findByPk(req.params.id, { include: [{ model: Booking, as: 'booking' }] });
  if (!payment) return error(res, 'NOT_FOUND', 'Payment not found', 404);
  return success(res, { payment });
};

// Initiate a generic payment intent (bank/MPesa) â€” creates a client-side payload for testing.
exports.initiatePayment = async (req, res) => {
  try {
    const { booking_id, method } = req.body;
    if (method === 'cash') {
      return error(res, 'VALIDATION_ERROR', 'Cash payments are disabled in this phase', 422);
    }
    const booking = await ensureBooking(booking_id);
    const paymentRequestId = `PAY-${uuid().split('-')[0]}`;

    await booking.update({ payment_status: 'pending' });
    await Payment.create({
      booking_id: booking.id,
      provider: 'mock',
      amount: booking.customer_rate || booking.final_fare || 0,
      status: 'pending',
      reference: paymentRequestId,
      metadata: { initiated_by: req.user.id },
    });
    if (req.auditLog) await req.auditLog('PAYMENT_INITIATED', { booking_id: booking.id, payment_request_id: paymentRequestId });

    return success(res, {
      payment_request_id: paymentRequestId,
      amount: booking.customer_rate || booking.final_fare || 0,
      currency: 'KES',
      checkout_url: `${process.env.PAYMENT_CHECKOUT_BASE || 'https://sandbox.pay.test/checkout'}/${paymentRequestId}`,
      note: 'Sandbox payment intent created (no live charge).',
    });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// Mock M-Pesa STK Push (no live credentials required)
exports.mpesaStkPush = async (req, res) => {
  try {
    const { booking_id, phone } = req.body;
    if (!booking_id || !phone) return error(res, 'VALIDATION_ERROR', 'booking_id and phone are required', 422);

    const booking = await ensureBooking(booking_id);
    const checkoutRequestID = `MPESA-${uuid().slice(0, 8)}`;

    await booking.update({ payment_status: 'held' });
    await Payment.create({
      booking_id: booking.id,
      provider: 'mpesa',
      amount: booking.customer_rate || booking.final_fare || 0,
      status: 'held',
      reference: checkoutRequestID,
      metadata: { phone, mode: process.env.MPESA_MODE || 'mock' },
    });
    if (req.auditLog) await req.auditLog('MPESA_STK_INITIATED', { booking_id: booking.id, phone, checkout_id: checkoutRequestID });

    return success(res, {
      checkout_request_id: checkoutRequestID,
      status: 'initiated',
      mode: process.env.MPESA_MODE || 'mock',
      message: 'Mock STK initiated (no real charge). Use /payment/mpesa/mock-callback to mark paid.',
    });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// Called by sandbox or test harness to mark a payment success/fail
exports.mpesaMockCallback = async (req, res) => {
  try {
    const { booking_id, status = 'success' } = req.body;
    const booking = await ensureBooking(booking_id);

    const isSuccess = status === 'success';
    await Payment.create({
      booking_id: booking.id,
      provider: 'mpesa',
      amount: booking.customer_rate || booking.final_fare || 0,
      status: isSuccess ? 'paid' : 'failed',
      reference: `MOCK-${uuid().slice(0,6)}`,
      metadata: { mode: 'mock', status },
    });
    if (isSuccess) await creditDriver(booking);
    await booking.update({ payment_status: isSuccess ? 'released' : 'pending' });

    if (isSuccess) {
      const customer = await loadCustomer(booking);
      sendPaymentNotification({ booking, customer, status: 'released' }).catch(console.error);
    }
    if (req.auditLog) await req.auditLog('MPESA_MOCK_CALLBACK', { booking_id: booking.id, status });

    return success(res, { message: `Payment marked ${status}`, payment_status: booking.payment_status });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// Production-style callback stub (accepts Daraja-like payload)
exports.mpesaCallback = async (req, res) => {
  try {
    const { Body } = req.body || {};
    const resultCode = Body?.stkCallback?.ResultCode;
    const metadata = Body?.stkCallback?.CallbackMetadata?.Item || [];
    const refItem = metadata.find((i) => i.Name === 'AccountReference');
    const bookingRef = refItem?.Value;

    if (!bookingRef) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted (no booking ref found)' });
    }

    const booking = await Booking.findOne({ where: { reference: bookingRef } });
    if (!booking) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted (booking not found)' });
    }

    const successTx = resultCode === 0;
    await Payment.create({
      booking_id: booking.id,
      provider: 'mpesa',
      amount: booking.customer_rate || booking.final_fare || 0,
      status: successTx ? 'paid' : 'failed',
      reference: bookingRef,
      metadata: { result_code: resultCode, raw: Body },
    });
    if (successTx) await creditDriver(booking);
    await booking.update({ payment_status: successTx ? 'released' : 'pending' });
    if (successTx) {
      const customer = await loadCustomer(booking);
      sendPaymentNotification({ booking, customer, status: 'released' }).catch(console.error);
    }
    if (req.auditLog) await req.auditLog('MPESA_CALLBACK', { booking_id: booking.id, result_code: resultCode });

    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('mpesaCallback error', err.message);
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted (with error logged)' });
  }
};

exports.generateInvoice = async (req, res) => {
  try {
    const booking = await ensureBooking(req.params.id);
    const customer = await loadCustomer(booking);
    try {
      const PDFDocument = require('pdfkit');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${booking.reference}.pdf"`);
      const doc = new PDFDocument({ margin: 36 });
      doc.pipe(res);
      doc.fontSize(18).text('ZITO Invoice', { align: 'left' });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Reference: ${booking.reference}`);
      doc.text(`Status: ${booking.payment_status}`);
      doc.text(`Customer: ${customer?.full_name || 'N/A'} (${customer?.email || ''})`);
      doc.text(`Pickup: ${booking.pickup_address}`);
      doc.text(`Delivery: ${booking.delivery_address}`);
      doc.moveDown();
      doc.text(`Customer Rate: KES ${booking.customer_rate || 0}`);
      doc.text(`Hire Rate: KES ${booking.hire_rate || 0}`);
      doc.text(`Total Expenses: KES ${booking.total_expenses || 0}`);
      doc.text(`Profit: KES ${booking.profit || 0}`);
      doc.moveDown();
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.end();
      return;
    } catch (pdfErr) {
      const html = `
        <html><body style="font-family:Arial,sans-serif;padding:24px;">
          <h2>ZITO Invoice</h2>
          <p><strong>Reference:</strong> ${booking.reference}</p>
          <p><strong>Status:</strong> ${booking.payment_status}</p>
          <p><strong>Customer:</strong> ${customer?.full_name || 'N/A'} (${customer?.email || ''})</p>
          <p><strong>Pickup:</strong> ${booking.pickup_address}</p>
          <p><strong>Delivery:</strong> ${booking.delivery_address}</p>
          <hr/>
          <p><strong>Customer Rate:</strong> KES ${booking.customer_rate || 0}</p>
          <p><strong>Hire Rate:</strong> KES ${booking.hire_rate || 0}</p>
          <p><strong>Total Expenses:</strong> KES ${booking.total_expenses || 0}</p>
          <p><strong>Profit:</strong> KES ${booking.profit || 0}</p>
          <p><small>Generated at ${new Date().toISOString()}</small></p>
        </body></html>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.releasePayment = async (req, res) => {
  try {
    const booking = await ensureBooking(req.params.id);
    await creditDriver(booking);
    await booking.update({ payment_status: 'released' });
    if (req.auditLog) await req.auditLog('PAYMENT_RELEASED', { booking_id: booking.id, by: req.user.id });
    const customer = await loadCustomer(booking);
    sendPaymentNotification({ booking, customer, status: 'released' }).catch(console.error);
    return success(res, { message: 'Payment released' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const booking = await ensureBooking(req.params.id);
    await booking.update({ payment_status: 'refunded' });
    if (req.auditLog) await req.auditLog('PAYMENT_REFUNDED', { booking_id: booking.id, by: req.user.id });
    const customer = await loadCustomer(booking);
    sendPaymentNotification({ booking, customer, status: 'refunded' }).catch(console.error);
    return success(res, { message: 'Payment refunded' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.freezePayment = async (req, res) => {
  try {
    const booking = await ensureBooking(req.params.id);
    await booking.update({ payment_status: 'frozen' });
    if (req.auditLog) await req.auditLog('PAYMENT_FROZEN', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Payment frozen pending dispute resolution' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
