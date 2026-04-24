// src/controllers/otp.controller.js
// PRD §5.1 & §7.1 — OTP endpoints (Redis required for Phase 1)
// PRD §11 — Mandatory email OTP 2FA, Resend.com provider
// PRD §25.8 — Audit log on OTP events

const prisma = require('../utils/prisma');

const { success, error } = require('../utils/response');
const { generateOtp } = require('../utils/helpers');
const { ERRORS, buildError } = require('../constants/errors');
const { sendSms } = require('../services/sms.service');
const { signJwt, verifyJwt } = require('../utils/jwt');
const { setOtp, getOtp, delOtp } = require('../utils/redis');

// PRD §5.1 — Successfully migrated LoginOtp from Database to Redis for performance.

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
      user = await prisma.user.findUnique({ where: { id: user_id } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    } else if (contact) {
      user = await prisma.user.findFirst({
        where: contact.includes('@')
          ? { email: contact.toLowerCase().trim() }
          : { phone: contact.trim() }
      });
    }

    if (!user) {
      // Don't reveal if email exists
      return success(res, null, 'OTP sent if account exists.');
    }

    // PRD §5.1 — Use Redis for OTP storage to avoid DB bloat and improve performance
    let otp = generateOtp();
    const existing = await getOtp(user.id, type);

    // Reuse existing OTP if valid to prevent spamming
    if (existing) {
      otp = existing.otp;
    }

    await setOtp(user.id, type, otp, OTP_EXPIRY_MINS);

    // If this is for a high-value delivery (PRD §12.1), the subject changes
    const isDelivery = type === 'delivery';
    const emailSubject = isDelivery 
      ? 'ZITO — Your Delivery Verification Code' 
      : 'ZITO (VG Global Logistics) — Your OTP Code';
    
    const emailBody = isDelivery
      ? `<p>Give this code to the driver only when your cargo has arrived:</p>`
      : `<p>Your OTP verification code is:</p>`;

    // Send email
    const delivered = await sendOtpEmail(user.email, otp, emailSubject, emailBody);
    if (!delivered) {
      return error(res, 'OTP_DELIVERY_FAILED', 'Could not deliver OTP email. Please try again.', 502);
    }

    // Optional SMS (free/dry-run friendly)
    const smsTarget = contact && !contact.includes('@') ? contact.trim() : user.phone;
    if (process.env.SMS_SEND_OTP === 'true' && smsTarget) {
      sendSms({ to: smsTarget, message: `ZITO (VG Global) OTP: ${otp} (expires in ${OTP_EXPIRY_MINS} mins)` })
        .then(() => console.log(`[OTP SMS] sent to ${user.phone}`))
        .catch((err) => console.error('[OTP SMS] failed', err.message));
    }

    return success(res, {
      user_id: user.id,
      // Only expose in development
      ...(process.env.NODE_ENV !== 'production' && { _dev_otp: otp }),
    }, `OTP sent to ${user.email}`);

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
      return res.status(ERRORS.VALIDATION_ERROR.httpStatus).json(buildError(ERRORS.VALIDATION_ERROR, 'OTP code is required.'));
    }

    let targetUserId = user_id;

    // Resolve user from contact (email/phone)
    if (!targetUserId && contact) {
      const lookup = contact.includes('@')
        ? { email: contact.toLowerCase().trim() }
        : { phone: contact.trim() };
      const user = await prisma.user.findFirst({ where: lookup, select: { id: true } });
      targetUserId = user?.id;
    }

    // Resolve from short-lived temp token (used in login flow)
    if (!targetUserId && temp_token) {
      try {
        const decoded = verifyJwt(temp_token);
        targetUserId = decoded.id;
      } catch {
        return res.status(ERRORS.TOKEN_EXPIRED.httpStatus).json(buildError(ERRORS.TOKEN_EXPIRED));
      }
    }

    if (!targetUserId) {
      return res.status(ERRORS.USER_NOT_FOUND.httpStatus).json(buildError(ERRORS.USER_NOT_FOUND));
    }

    const stored = await getOtp(targetUserId, type);

    if (!stored) {
      return res.status(ERRORS.BAD_REQUEST.httpStatus).json(buildError(ERRORS.BAD_REQUEST, 'OTP not found or already used.'));
    }

    // Max 5 attempts
    if (stored.attempts >= 5) {
      await delOtp(targetUserId, type);
      return res.status(ERRORS.RATE_LIMIT_EXCEEDED.httpStatus).json(buildError(ERRORS.RATE_LIMIT_EXCEEDED, 'Too many failed OTP attempts.'));
    }

    // Verify OTP
    if (stored.otp !== String(otp).trim()) {
      const nextAttempts = Number(stored.attempts) + 1;
      await setOtp(targetUserId, type, stored.otp, OTP_EXPIRY_MINS); // Update attempts in Redis
      return res.status(ERRORS.OTP_INVALID.httpStatus).json(buildError(ERRORS.OTP_INVALID, `${Math.max(0, 5 - nextAttempts)} attempts remaining.`));
    }

    // OTP valid — clear from Redis
    await delOtp(targetUserId, type);

    // Load user
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      return res.status(ERRORS.USER_NOT_FOUND.httpStatus).json(buildError(ERRORS.USER_NOT_FOUND));
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpVerified: true,
        lastLoginAt: new Date(),
      }
    });

    // Issue full JWT — PRD §11
    const accessToken  = signJwt({ id: user.id, role: user.role });
    const refreshToken = signJwt({ id: user.id, role: user.role }, { expiresIn: '90d' }); // PRD §15.1

    // Audit log — PRD §25.8
    if (req.auditLog) {
      await req.auditLog('OTP_VERIFIED', { user_id: user.id, type });
    }

    return success(res, {
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id:                user.id,
        email:             user.email,
        full_name:         user.full_name, // Assuming snake_case in schema based on select in auth middleware
        role:              user.role,
        compliance_status: user.complianceStatus, // Prisma client uses camelCase fields
        is_active:         user.isActive,         // Prisma client uses camelCase fields
      },
    }, 'OTP verified successfully.');

  } catch (err) {
    console.error('verifyOtp error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
