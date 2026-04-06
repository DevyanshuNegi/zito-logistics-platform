// src/controllers/otp.controller.js
// PRD §12 — OTP endpoints
// PRD §11 — Mandatory email OTP 2FA, Resend.com provider
// PRD §25.8 — Audit log on OTP events

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User }   = require('../models');
const { success, error } = require('../utils/response');

// ── OTP Store (DB table: login_otps) ──────────────────────────────────────
// Using sequelize model if available, fallback to in-memory for Phase 1
// In production use the login_otps table defined in PRD §8

const generateOtp = () => {
  // PRD §12 — 6-digit OTP
  return crypto.randomInt(100000, 999999).toString();
};

const OTP_EXPIRY_MINS = parseInt(process.env.OTP_EXPIRY_MINS || '10', 10);

// In-memory OTP store for Phase 1 (replace with DB in Phase 2)
const otpStore = new Map();

const sendOtpEmail = async (email, otp) => {
  // PRD §9 — Email via Resend.com
  // PRD §24 — notification system
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from:    process.env.EMAIL_FROM || 'noreply@vglogistics.com',
      to:      email,
      subject: 'VG Global Logistics — Your OTP Code',
      html:    `
        <h2>VG Global Logistics</h2>
        <p>Your OTP verification code is:</p>
        <h1 style="letter-spacing:8px; color:#1A3A5C;">${otp}</h1>
        <p>This code expires in ${OTP_EXPIRY_MINS} minutes.</p>
        <p>Do not share this code with anyone.</p>
      `,
    });
  } catch (err) {
    // Log but don't crash — fall through so OTP is still returned in dev
    console.error('Email send error:', err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }
  }
};

// ── Send OTP ──────────────────────────────────────────────────────────────
// POST /api/v1/auth/send-otp
// PRD §12 — Send OTP to email or mobile

exports.sendOtp = async (req, res) => {
  try {
    const { email, user_id, type = 'login' } = req.body;
    // type: 'login' | 'reset_password' | 'verify_email'

    if (!email && !user_id) {
      return error(res, 'VALIDATION_ERROR', 'email or user_id required', 422);
    }

    // Find user
    let user;
    if (user_id) {
      user = await User.findByPk(user_id);
    } else {
      user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    }

    if (!user) {
      // Don't reveal if email exists
      return success(res, { message: 'OTP sent if account exists.' });
    }

    const otp     = generateOtp();
    const key     = `${user.id}:${type}`;
    const expires = Date.now() + OTP_EXPIRY_MINS * 60 * 1000;

    // Store OTP
    otpStore.set(key, { otp, expires, attempts: 0 });

    // Send email
    await sendOtpEmail(user.email, otp);

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
    const { user_id, otp, type = 'login', temp_token } = req.body;

    if (!otp) {
      return error(res, 'VALIDATION_ERROR', 'OTP required', 422);
    }

    // Resolve user_id from temp_token if not provided directly
    let resolvedUserId = user_id;
    if (!resolvedUserId && temp_token) {
      try {
        const decoded = jwt.verify(temp_token, process.env.JWT_SECRET);
        resolvedUserId = decoded.id;
      } catch {
        return error(res, 'INVALID_TOKEN', 'Invalid or expired session. Please log in again.', 401);
      }
    }

    if (!resolvedUserId) {
      return error(res, 'VALIDATION_ERROR', 'user_id or temp_token required', 422);
    }

    const key    = `${resolvedUserId}:${type}`;
    const stored = otpStore.get(key);

    if (!stored) {
      return error(res, 'OTP_NOT_FOUND', 'OTP not found or already used. Request a new one.', 400);
    }

    // Check expiry
    if (Date.now() > stored.expires) {
      otpStore.delete(key);
      return error(res, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.', 400);
    }

    // Max 5 attempts
    if (stored.attempts >= 5) {
      otpStore.delete(key);
      return error(res, 'OTP_MAX_ATTEMPTS', 'Too many failed attempts. Request a new OTP.', 429);
    }

    // Verify OTP
    if (stored.otp !== otp.trim()) {
      stored.attempts += 1;
      return error(res, 'INVALID_OTP', `Invalid OTP. ${5 - stored.attempts} attempts remaining.`, 400);
    }

    // OTP valid — remove from store
    otpStore.delete(key);

    // Load user
    const user = await User.findByPk(resolvedUserId);
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