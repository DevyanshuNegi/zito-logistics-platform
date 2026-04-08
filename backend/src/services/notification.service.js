// src/services/notification.service.js
// Lightweight notification layer (email via Resend, SMS via sms.service)
// Falls back to console logging when no credentials are provided.

const { sendSms } = require('./sms.service');
const { User, Driver, Vehicle, BookingOffer } = require('../models');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'ZITO <noreply@zito.test>';
const NOTIFY_ENABLED = process.env.NOTIFY_ENABLED !== 'false';

const sendEmail = async ({ to, subject, html, text }) => {
  if (!NOTIFY_ENABLED) return { skipped: true, reason: 'notifications disabled' };
  if (!to) return { skipped: true, reason: 'no recipient' };
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL:DRY_RUN] to=${to} subject="${subject}"`);
    return { dryRun: true };
  }
  const { Resend } = require('resend');
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html: html || `<p>${text || ''}</p>`,
  });
  return { sent: true };
};

const sendBookingNotification = async ({ booking, customer, event, extra }) => {
  if (!booking || !customer) return;
  const toEmail = customer.email;
  const toPhone = customer.phone;

  const subject = {
    created: `Booking ${booking.reference} received`,
    status:  `Booking ${booking.reference} is now ${booking.status}`,
    cancelled: `Booking ${booking.reference} cancelled`,
  }[event] || `Booking ${booking.reference}`;

  const text = {
    created: `We received your booking ${booking.reference}. Status: ${booking.status}.`,
    status:  `Your booking ${booking.reference} status changed to ${booking.status}.`,
    cancelled: `Your booking ${booking.reference} was cancelled.`,
  }[event] || '';

  await sendEmail({ to: toEmail, subject, text });
  if (process.env.SMS_SEND_EVENTS === 'true' && toPhone) {
    await sendSms({ to: toPhone, message: text || subject });
  }
};

const sendPaymentNotification = async ({ booking, customer, status }) => {
  if (!booking || !customer) return;
  const subject = `Payment ${status} for ${booking.reference}`;
  const text = `Payment status for booking ${booking.reference}: ${status}`;
  await sendEmail({ to: customer.email, subject, text });
  if (process.env.SMS_SEND_EVENTS === 'true' && customer.phone) {
    await sendSms({ to: customer.phone, message: text });
  }
};

/* -------------------------------------------------------------------------- */
/* DRIVER ASSIGNMENT                                                          */
/* -------------------------------------------------------------------------- */

const getIO = () => {
  try {
    const app = require('../app');
    return app.get('io') || (app.get('getIO') && app.get('getIO')());
  } catch {
    return null;
  }
};

const notifyDriverAssignment = async ({ booking, driver_id }) => {
  if (!booking || !driver_id) return;
  const driver = await Driver.findByPk(driver_id, {
    include: [{ model: User, as: 'user', attributes: ['email', 'phone', 'full_name'] }, { model: Vehicle, as: 'current_vehicle' }]
  });
  if (!driver) return;

  const io = getIO();
  const payload = {
    booking_id: booking.id,
    reference: booking.reference,
    pickup: booking.pickup_address,
    delivery: booking.delivery_address,
    status: booking.status,
    vehicle_id: booking.vehicle_id,
  };
  if (io) {
    io.to(`driver:${driver.id}`).emit('assignment:assigned', payload);
    io.to(`user:${driver.user_id}`).emit('assignment:assigned', payload);
  } else {
    console.log(`[SOCKET:DRY_RUN] assignment:assigned -> driver:${driver.id} ref=${booking.reference}`);
  }

  const subject = `New trip assigned: ${booking.reference}`;
  const text = `You have been assigned booking ${booking.reference}. Pickup: ${booking.pickup_address}`;
  if (driver.user?.email) {
    await sendEmail({ to: driver.user.email, subject, text });
  }
  if (process.env.SMS_SEND_EVENTS === 'true' && driver.user?.phone) {
    await sendSms({ to: driver.user.phone, message: text });
  }
};

module.exports = {
  sendEmail,
  sendBookingNotification,
  sendPaymentNotification,
  notifyDriverAssignment,
  getIO,
  /* Offer notifications */
  notifyOfferResponse: async ({ offer, booking, status }) => {
    if (!offer || !booking) return;
    const bidder = await User.findByPk(offer.user_id);
    const io = getIO();
    const payload = {
      booking_id: booking.id,
      reference: booking.reference,
      offer_id: offer.id,
      status,
      price: offer.price,
    };
    if (io && bidder) {
      io.to(`user:${bidder.id}`).emit('offer:response', payload);
    }
    const subject = `Your offer on ${booking.reference} was ${status}`;
    const text = `Offer ${offer.id} for booking ${booking.reference} is ${status}.`;
    if (bidder?.email) await sendEmail({ to: bidder.email, subject, text });
    if (process.env.SMS_SEND_EVENTS === 'true' && bidder?.phone) {
      await sendSms({ to: bidder.phone, message: text });
    }
  },

  /* New offer placed: notify admin/super + customer if they own the booking */
  notifyOfferCreated: async ({ offer, booking }) => {
    if (!offer || !booking) return;
    const bidder = await User.findByPk(offer.user_id);
    const io = getIO();
    const payload = {
      booking_id: booking.id,
      reference: booking.reference,
      offer_id: offer.id,
      price: offer.price,
      role: offer.role,
    };
    // Admin broadcast
    if (io) {
      io.to('role:super_admin').emit('offer:new', payload);
      io.to('role:operations_admin').emit('offer:new', payload);
    }
    // Customer notification
    if (booking.customer_id) {
      const customer = await User.findByPk(booking.customer_id);
      const subject = `New offer for ${booking.reference}`;
      const text = `An offer of ${offer.price} was submitted for your booking ${booking.reference}.`;
      if (customer?.email) await sendEmail({ to: customer.email, subject, text });
      if (process.env.SMS_SEND_EVENTS === 'true' && customer?.phone) {
        await sendSms({ to: customer.phone, message: text });
      }
    }
    // Bidder confirmation (quiet)
    if (bidder?.email) {
      await sendEmail({ to: bidder.email, subject: `Offer submitted for ${booking.reference}`, text: 'Your offer has been recorded.' });
    }
  },
};
