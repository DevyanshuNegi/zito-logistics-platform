// src/controllers/otp.controller.js
// PRD v8.0 §5.1 & §7.1 — OTP endpoints (Redis required for Phase 1)
// PRD §11 — Mandatory email OTP 2FA, Resend.com provider
// PRD §25.8 — Audit log on OTP events

const prisma = require('../utils/prisma');

const { success, error } = require('../utils/response');
const { generateOtp } = require('../utils/helpers');
const { ERRORS, buildError } = require('../constants/errors');
const { sendSms } = require('../services/sms.service');
const { signJwt, verifyJwt } = require('../utils/jwt');

// TODO: Migration §5.1 — Move LoginOtp from Sequelize to Redis

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

    let otp;

    // For login flow, reuse active OTP instead of rotating.
    // This prevents invalid-OTP when user receives delayed/duplicated emails.
    const activeOtp = await prisma.loginOtp.findFirst({
      where: {
        userId: user.id,
        type,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' },
    });

    if (type === 'login' && activeOtp) {
      otp = activeOtp.otp;
    } else {
      otp = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60 * 1000);

      // Invalidate old unconsumed OTP rows for this user+type before creating new one
      await prisma.loginOtp.updateMany({
        where: { userId: user.id, type, consumedAt: null },
        data: { consumedAt: new Date() }
      });

      await prisma.loginOtp.create({
        data: {
          userId: user.id,
          contact: user.email,
          otp,
          type,
          expiresAt,
          attempts: 0,
        }
      });
    }

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
      resolvedUser = await prisma.user.findFirst({ where: lookup });
      resolvedUserId = resolvedUser?.id;
    }

    // Resolve from temp token
    if (!resolvedUserId && temp_token) {
      try {
        const decoded = verifyJwt(temp_token);
        resolvedUserId = decoded.id;
      } catch {
        return error(res, 'INVALID_TOKEN', 'Invalid or expired session. Please log in again.', 401);
      }
    }

    if (!resolvedUserId) {
      return error(res, 'VALIDATION_ERROR', 'user_id, contact or temp_token required', 422);
    }

    const stored = await prisma.loginOtp.findFirst({
      where: {
        userId: resolvedUserId,
        type,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!stored) {
      return error(res, 'OTP_NOT_FOUND', 'OTP not found or already used. Request a new one.', 400);
    }

    // Check expiry
    if (Date.now() > new Date(stored.expiresAt).getTime()) {
      await prisma.loginOtp.update({
        where: { id: stored.id },
        data: { consumedAt: new Date() }
      });
      return error(res, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.', 400);
    }

    // Max 5 attempts
    if (stored.attempts >= 5) {
      await prisma.loginOtp.update({
        where: { id: stored.id },
        data: { consumedAt: new Date() }
      });
      return error(res, 'OTP_MAX_ATTEMPTS', 'Too many failed attempts. Request a new OTP.', 429);
    }

    // Verify OTP
    if (stored.otp !== String(otp).trim()) {
      const nextAttempts = Number(stored.attempts || 0) + 1;
      await prisma.loginOtp.update({
        where: { id: stored.id },
        data: { attempts: nextAttempts }
      });
      return error(res, 'INVALID_OTP', `Invalid OTP. ${Math.max(0, 5 - nextAttempts)} attempts remaining.`, 400);
    }

    // OTP valid — mark consumed
    await prisma.loginOtp.update({
      where: { id: stored.id },
      data: { consumedAt: new Date() }
    });

    // Load user
    const user = resolvedUser || await prisma.user.findUnique({ where: { id: resolvedUserId } });
    if (!user) {
      return error(res, 'NOT_FOUND', 'User not found', 404);
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
        compliance_status: user.complianceStatus, // PRD v8 uses camelCase in Prisma
        is_active:         user.isActive,         // PRD v8 uses camelCase in Prisma
      },
    }, 'OTP verified successfully.');

  } catch (err) {
    console.error('verifyOtp error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
