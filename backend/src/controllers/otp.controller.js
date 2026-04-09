// src/controllers/otp.controller.js
// PRD §12 — OTP endpoints
// PRD §11 — Mandatory email OTP 2FA, Resend.com provider
// PRD §25.8 — Audit log on OTP events

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, LoginOtp } = require('../models');
const { success, error } = require('../utils/response');
const { sendSms } = require('../services/sms.service');

const generateOtp = () => {
  // PRD §12 — 6-digit OTP
  return crypto.randomInt(100000, 999999).toString();
};

const OTP_EXPIRY_MINS = parseInt(process.env.OTP_EXPIRY_MINS || '10', 10);

const sendOtpEmail = async (email, otp) => {
  // PRD §9 — Email via Resend.com
  // PRD §24 — notification system
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from:    process.env.EMAIL_FROM || 'noreply@vggloballogistics.com',
      to:      email,
      subject: 'ZITO (VG Global Logistics) — Your OTP Code',
      html:    `
        <h2>ZITO (VG Global Logistics)</h2>
        <p>Your OTP verification code is:</p>
        <h1 style="letter-spacing:8px; color:#1A3A5C;">${otp}</h1>
        <p>This code expires in ${OTP_EXPIRY_MINS} minutes.</p>
        <p>Do not share this code with anyone.</p>
      `,
    });
    return true;
  } catch (err) {
    // In dev, allow fallback so local testing can continue with _dev_otp.
    // In production, surface delivery failure so UI can prompt retry.
    console.error('Email send error:', err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
      return true;
    }
    return false;
  }
};

// ── Send OTP ──────────────────────────────────────────────────────────────
// POST /api/v1/auth/send-otp
// PRD §12 — Send OTP to email or mobile

exports.sendOtp = async (req, res) => {
  try {
    const { email, contact, user_id, type = 'login' } = req.body;
    // type: 'login' | 'reset_password' | 'verify_email'

    if (!email && !contact && !user_id) {
      return error(res, 'VALIDATION_ERROR', 'email, contact or user_id required', 422);
    }

    // Find user (email > contact > user_id)
    let user;
    if (user_id) {
      user = await User.findByPk(user_id);
    } else if (email) {
      user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    } else if (contact) {
      const lookup = contact.includes('@')
        ? { email: contact.toLowerCase().trim() }
        : { phone: contact.trim() };
      user = await User.findOne({ where: lookup });
    }

    if (!user) {
      // Don't reveal if email exists
      return success(res, { message: 'OTP sent if account exists.' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60 * 1000);

    // Invalidate old unconsumed OTP rows for this user+type
    await LoginOtp.update(
      { consumed_at: new Date() },
      {
        where: {
          user_id: user.id,
          type,
          consumed_at: null,
        },
      }
    );

    await LoginOtp.create({
      user_id: user.id,
      contact: user.email,
      otp,
      type,
      expires_at: expiresAt,
      attempts: 0,
    });

    // Send email
    const delivered = await sendOtpEmail(user.email, otp);
    if (!delivered) {
      return error(res, 'OTP_DELIVERY_FAILED', 'Could not deliver OTP email. Please try again.', 502);
    }

    // Optional SMS (free/dry-run friendly)
    const smsTarget = contact && !contact.includes('@') ? contact.trim() : user.phone;
    if (process.env.SMS_SEND_OTP === 'true' && smsTarget) {
      sendSms({ to: smsTarget, message: `ZITO OTP: ${otp} (expires in ${OTP_EXPIRY_MINS} mins)` })
        .then(() => console.log(`[OTP SMS] sent to ${user.phone}`))
        .catch((err) => console.error('[OTP SMS] failed', err.message));
    }

    return success(res, {
      message: `OTP sent to ${user.email}`,
      // Only expose in development
      ...(process.env.NODE_ENV !== 'production' && { _dev_otp: otp }),
    });

  } catch (err) {
    console.error('sendOtp error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Verify OTP ────────────────────────────────────────────────────────────
// POST /api/v1/auth/verify-otp
// PRD §12 — Verify OTP and return full JWT

exports.verifyOtp = async (req, res) => {
  try {
    const { user_id, contact, otp, type = 'login', temp_token } = req.body;

    if (!otp) {
      return error(res, 'VALIDATION_ERROR', 'OTP required', 422);
    }

    // Resolve user_id from temp_token if not provided directly
    let resolvedUserId = user_id;
    let resolvedUser   = null;

    // Resolve from contact (email/phone)
    if (!resolvedUserId && contact) {
      const lookup = contact.includes('@')
        ? { email: contact.toLowerCase().trim() }
        : { phone: contact.trim() };
      resolvedUser = await User.findOne({ where: lookup });
      resolvedUserId = resolvedUser?.id;
    }

    // Resolve from temp token
    if (!resolvedUserId && temp_token) {
      try {
        const decoded = jwt.verify(temp_token, process.env.JWT_SECRET);
        resolvedUserId = decoded.id;
      } catch {
        return error(res, 'INVALID_TOKEN', 'Invalid or expired session. Please log in again.', 401);
      }
    }

    if (!resolvedUserId) {
      return error(res, 'VALIDATION_ERROR', 'user_id, contact or temp_token required', 422);
    }

        const stored = await LoginOtp.findOne({
          where: {
            user_id: resolvedUserId,
            type,
            consumed_at: null,
          },
          order: [['created_at', 'DESC']],
        });

    if (!stored) {
      return error(res, 'OTP_NOT_FOUND', 'OTP not found or already used. Request a new one.', 400);
    }

    // Check expiry
    if (Date.now() > new Date(stored.expires_at).getTime()) {
      await stored.update({ consumed_at: new Date() });
      return error(res, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.', 400);
    }

    // Max 5 attempts
    if (stored.attempts >= 5) {
      await stored.update({ consumed_at: new Date() });
      return error(res, 'OTP_MAX_ATTEMPTS', 'Too many failed attempts. Request a new OTP.', 429);
    }

    // Verify OTP
    if (stored.otp !== String(otp).trim()) {
      const nextAttempts = Number(stored.attempts || 0) + 1;
      await stored.update({ attempts: nextAttempts });
      return error(res, 'INVALID_OTP', `Invalid OTP. ${Math.max(0, 5 - nextAttempts)} attempts remaining.`, 400);
    }

    // OTP valid — mark consumed
    await stored.update({ consumed_at: new Date() });

    // Load user
    const user = resolvedUser || await User.findByPk(resolvedUserId);
    if (!user) {
      return error(res, 'NOT_FOUND', 'User not found', 404);
    }

    // Update last login
    await user.update({
      otp_verified: true,
      last_login_at: new Date(),
    });

    // Issue full JWT — PRD §11
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    // Audit log — PRD §25.8
    if (req.auditLog) {
      await req.auditLog('OTP_VERIFIED', { user_id: user.id, type });
    }

    return success(res, {
      message: 'OTP verified successfully.',
      token,
      accessToken: token,
      user: {
        id:                user.id,
        email:             user.email,
        full_name:         user.full_name,
        role:              user.role,
        compliance_status: user.compliance_status,
        is_active:         user.is_active,
      },
    });

  } catch (err) {
    console.error('verifyOtp error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
