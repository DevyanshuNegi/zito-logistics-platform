// src/controllers/payment.controller.js
// PRD §25.6 — Payment Hold & Release Lifecycle
// PRD §9 — M-Pesa Phase 2 (sandbox / mock friendly)

const { randomUUID: uuid } = require('crypto');
const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { sendPaymentNotification } = require('../services/notification.service');
const mpesa = require('../services/mpesa');

const ensureBooking = async (id) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error('NOT_FOUND');
  return booking;
};

/**
 * PRD §15.1 — Move funds to driver wallet on trip release
 */
const creditDriver = async (bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { tripCharges: { where: { status: 'approved', chargeType: 'driver_expense' } } }
  });

  if (!booking || booking.paymentStatus === 'released' || !booking.assignedDriverId) return;

  const expenseSum = booking.tripCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const hire = Number(booking.hireRate || 0);
  const credit = hire + expenseSum;

  await prisma.driver.update({
    where: { id: booking.assignedDriverId },
    data: {
      walletBalance: { increment: credit },
      pendingPayout: { increment: credit },
      lastPayoutAt: new Date()
    }
  });
};

exports.getPayments = async (req, res) => {
  try {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    include: { booking: { select: { reference: true, customerRate: true, hireRate: true, paymentStatus: true } } },
    take: Number(req.query.limit) || 500,
  });
  return success(res, { payments });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
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

    // PRD §7.14 — No cash initially
    if (provider === 'cash' || method === 'cash') {
      return error(res, 'PAYMENT_METHOD_NOT_ALLOWED', 'Cash payments are not supported in Phase 1', 400);
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

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: normalizedProvider,
        amount: Number(amount_kes ?? amount ?? booking.customerRate ?? booking.finalFare ?? 0),
        status: normalizedStatus,
        reference: mpesa_ref || reference || `FIN-${uuid().slice(0, 8).toUpperCase()}`,
        metadata: {
          notes: notes || null,
          recorded_by: req.user.id,
          recorded_by_role: req.user.role,
          source: 'finance_manual',
        },
      },
    });

    let bookingPaymentStatus = normalizedStatus;

    if (normalizedStatus === 'paid') {
      await creditDriver(booking.id);
      await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'released' } });
      bookingPaymentStatus = 'released';
      const customer = await prisma.user.findUnique({ where: { id: booking.customerId } });
      if (customer) sendPaymentNotification({ booking, customer, status: 'released' }).catch(console.error);
    } else {
      await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: normalizedStatus } });
    }

    if (req.auditLog) {
      await req.auditLog('PAYMENT_RECORDED', {
        booking_id: booking.id,
        payment_id: payment.id,
        status: normalizedStatus,
        by: req.user.id,
      });
    }

    return success(res, {
      payment,
      booking_payment_status: bookingPaymentStatus,
    }, 'Payment recorded successfully');
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { booking: true }
    });

    if (!payment) return error(res, 'NOT_FOUND', 'Payment not found', 404);
    return success(res, { payment });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// Initiate a generic payment intent — creates a client-side payload for testing.
exports.initiatePayment = async (req, res) => {
  try {
    const { booking_id, method } = req.body;
    if (method === 'cash') {
      return error(res, 'VALIDATION_ERROR', 'Cash payments are disabled in this phase', 422);
    }
    const booking = await ensureBooking(booking_id);
    const paymentRequestId = `PAY-${uuid().split('-')[0]}`;

    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'pending' } });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: 'mock',
        amount: Number(booking.customerRate || booking.finalFare || 0),
        status: 'pending',
        reference: paymentRequestId,
        metadata: { initiated_by: req.user.id }
      }
    });
    if (req.auditLog) await req.auditLog('PAYMENT_INITIATED', { booking_id: booking.id, payment_request_id: paymentRequestId });

    return success(res, {
      payment_request_id: paymentRequestId,
      amount: booking.customerRate || booking.finalFare || 0,
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

    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'held' } });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: 'mpesa',
        amount: Number(booking.customerRate || booking.finalFare || 0),
        status: 'held',
        reference: checkoutRequestID,
        metadata: { phone, mode: process.env.MPESA_MODE || 'mock' },
      }
    });
    if (req.auditLog) await req.auditLog('MPESA_STK_INITIATED', { booking_id: booking.id, phone, checkout_id: checkoutRequestID });

    return success(res, {
      checkout_request_id: checkoutRequestID,
      status: 'initiated',
      mode: process.env.MPESA_MODE || 'mock',
      message: 'Mock STK initiated (no real charge). Use /payment/mpesa/mock-callback to mark paid.',
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// Called by sandbox or test harness to mark a payment success/fail
exports.mpesaMockCallback = async (req, res) => {
  try {
    const { booking_id, status = 'success' } = req.body;
    const booking = await ensureBooking(booking_id);

    const isSuccess = status === 'success';
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: 'mpesa',
        amount: Number(booking.customerRate || booking.finalFare || 0),
        status: isSuccess ? 'paid' : 'failed',
        reference: `MOCK-${uuid().slice(0,6)}`,
        metadata: { mode: 'mock', status }
      }
    });
    if (isSuccess) await creditDriver(booking.id);
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: isSuccess ? 'released' : 'pending' } });

    if (isSuccess) {
      const customer = await prisma.user.findUnique({ where: { id: booking.customerId } });
      if (customer) sendPaymentNotification({ booking, customer, status: 'released' }).catch(console.error);
    }
    if (req.auditLog) await req.auditLog('MPESA_MOCK_CALLBACK', { booking_id: booking.id, status });

    return success(res, { message: `Payment marked ${status}` });
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

    const booking = await prisma.booking.findFirst({ where: { reference: bookingRef } });
    if (!booking) return res.json({ ResultCode: 0, ResultDesc: 'Accepted (booking not found)' });

    const successTx = resultCode === 0;
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: 'mpesa',
        amount: Number(booking.customerRate || booking.finalFare || 0),
        status: successTx ? 'paid' : 'failed',
        reference: bookingRef,
        metadata: { result_code: resultCode, raw: Body }
      }
    });

    if (successTx) await creditDriver(booking.id);
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: successTx ? 'released' : 'pending' } });
    
    if (successTx) {
      const customer = await prisma.user.findUnique({ where: { id: booking.customerId } });
      if (customer) sendPaymentNotification({ booking, customer, status: 'released' }).catch(console.error);
    }

    if (req.auditLog) await req.auditLog('MPESA_CALLBACK', { booking_id: booking.id, result_code: resultCode });

    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted (with error logged)' });
  }
};

exports.generateInvoice = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ 
      where: { id: req.params.id },
      include: { customer: true }
    });

    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    try {
      const PDFDocument = require('pdfkit'); // PRD §16
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${booking.reference}.pdf"`);
      const doc = new PDFDocument({ margin: 36 });
      doc.pipe(res);
      doc.fontSize(18).text('ZITO Invoice', { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text(`Reference: ${booking.reference}`);
      doc.text(`Status: ${booking.paymentStatus}`);
      doc.text(`Customer: ${booking.customer?.full_name || 'N/A'}`);
      doc.text(`Pickup: ${booking.pickupAddress || ''}`);
      doc.text(`Delivery: ${booking.deliveryAddress || ''}`);
      doc.moveDown();
      doc.text(`Hire Rate: KES ${booking.hireRate || 0}`);
      doc.text(`Customer Rate: KES ${booking.customerRate || 0}`);
      doc.text(`Profit: KES ${booking.profit || 0}`);
      doc.moveDown();
      doc.end();
      return;
    } catch (pdfErr) {
      const html = `
        <html><body style="font-family:Arial,sans-serif;padding:24px;">
          <h2>ZITO Invoice</h2>
          <p><strong>Reference:</strong> ${booking.reference || ''}</p>
          <p><strong>Status:</strong> ${booking.paymentStatus || ''}</p>
          <p><strong>Customer:</strong> ${booking.customer?.full_name || 'N/A'}</p>
          <p><strong>Pickup:</strong> ${booking.pickupAddress || ''}</p>
          <p><strong>Delivery:</strong> ${booking.deliveryAddress}</p>
          <hr/>
          <p><strong>Customer Rate:</strong> KES ${booking.customerRate || 0}</p>
          <p><strong>Hire Rate:</strong> KES ${booking.hireRate || 0}</p>
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
    await creditDriver(req.params.id);
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { paymentStatus: 'released' }
    });
    if (req.auditLog) await req.auditLog('PAYMENT_RELEASED', { booking_id: booking.id, by: req.user.id });
    const customer = await prisma.user.findUnique({ where: { id: booking.customerId } });
    if (customer) sendPaymentNotification({ booking, customer, status: 'released' }).catch(console.error);
    return success(res, { message: 'Payment released' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { paymentStatus: 'refunded' }
    });

    if (req.auditLog) await req.auditLog('PAYMENT_REFUNDED', { booking_id: booking.id, by: req.user.id });
    const customer = await prisma.user.findUnique({ where: { id: booking.customerId } });
    if (customer) sendPaymentNotification({ booking, customer, status: 'refunded' }).catch(console.error);
    
    return success(res, { message: 'Payment refunded' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.freezePayment = async (req, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { paymentStatus: 'frozen' }
    });
    
    if (req.auditLog) await req.auditLog('PAYMENT_FROZEN', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Payment frozen pending dispute resolution' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * PRD §15 — M-Pesa B2B Disbursement (Payouts)
 * POST /api/v1/payments/payout/disburse
 */
exports.disbursePayout = async (req, res) => {
  try {
    const { driver_id, amount } = req.body;

    if (!driver_id || !amount) {
      return error(res, 422, 'VALIDATION_ERROR', 'driver_id and amount are required');
    }

    const driver = await prisma.driver.findUnique({
      where: { id: driver_id },
      include: { user: { select: { phone: true, full_name: true } } }
    });

    if (!driver) return error(res, 404, 'NOT_FOUND', 'Driver not found');
    if (Number(driver.walletBalance) < Number(amount)) {
      return error(res, 400, 'INSUFFICIENT_FUNDS', 'Insufficient wallet balance for payout');
    }

    // Trigger Safaricom B2C API — PRD §15
    const mpesaResult = await mpesa.b2cDisbursement({
      phone: driver.user.phone,
      amount: Number(amount),
      remarks: `Payout to ${driver.user.full_name}`
    });

    // Update wallet on success
    await prisma.driver.update({
      where: { id: driver.id },
      data: {
        walletBalance: { decrement: Number(amount) },
        pendingPayout: { decrement: Number(amount) },
        lastPayoutAt: new Date()
      }
    });

    if (req.auditLog) await req.auditLog('DRIVER_PAYOUT_DISBURSED', { driver_id, amount, mpesa_ref: mpesaResult.ConversationID });

    return success(res, { mpesa_result: mpesaResult }, 'Payout disbursed successfully');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};
