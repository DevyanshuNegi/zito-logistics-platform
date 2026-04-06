// src/controllers/auth.controller.js
// PRD §12 — Authentication endpoints
// PRD §11 — bcrypt (12 rounds), JWT, mandatory 2FA OTP
// PRD §25.8 — Audit log on login/logout
// PRD §25.9 — Soft delete check on login

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { User } = require('../models');
const { success, error } = require('../utils/response');
const { ROLES }          = require('../middleware/auth');

// ── Helpers ───────────────────────────────────────────────────────────────

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

const generateBookingReference = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'VG';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
};

// ── Register ──────────────────────────────────────────────────────────────
// PRD §12 POST /api/v1/auth/register

exports.register = async (req, res) => {
  try {
    const {
      full_name, email, phone, password,
      role = ROLES.CUSTOMER,
      id_number, transporter_id, agent_id, agency_id,
    } = req.body;

    // Validate required fields
    if (!full_name || !email || !phone || !password) {
      return error(res, 'VALIDATION_ERROR', 'full_name, email, phone and password are required', 422);
    }

    // Check existing user
    const existing = await User.findOne({
      where: { email },
      paranoid: false, // include soft-deleted
    });
    if (existing) {
      return error(res, 'DUPLICATE_ENTRY', 'Email already registered', 409);
    }

    const existingPhone = await User.findOne({
      where: { phone },
      paranoid: false,
    });
    if (existingPhone) {
      return error(res, 'DUPLICATE_ENTRY', 'Phone number already registered', 409);
    }

    // Hash password — PRD §11 bcrypt 12 rounds
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      full_name,
      email:      email.toLowerCase().trim(),
      phone:      phone.trim(),
      password_hash,
      role,
      id_number,
      transporter_id: transporter_id || null,
      agent_id:       agent_id       || null,
      agency_id:      agency_id      || null,
      compliance_status: [ROLES.DRIVER, ROLES.TRANSPORTER].includes(role)
        ? 'pending'
        : 'approved', // customers/agents approved immediately
    });

    // Audit log — PRD §25.8
    if (req.auditLog) {
      await req.auditLog('USER_REGISTERED', { user_id: user.id, role });
    }

    return success(res, {
      message: 'Registration successful. Please verify your email with OTP.',
      user: {
        id:       user.id,
        email:    user.email,
        role:     user.role,
        full_name: user.full_name,
      },
    }, 201);

  } catch (err) {
    console.error('register error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────
// PRD §12 POST /api/v1/auth/login
// Step 1: verify password → trigger OTP (Step 2 is in otp.controller)

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'VALIDATION_ERROR', 'Email and password required', 422);
    }

    // Find user
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return error(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // PRD §25.9 — soft delete check
    if (user.is_deleted) {
      return error(res, 'ACCOUNT_DELETED', 'This account has been removed', 401);
    }

    // PRD §17 — inactive accounts blocked
    if (!user.is_active) {
      return error(res, 'ACCOUNT_INACTIVE', 'Account is suspended. Contact support.', 401);
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return error(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // PRD §11 — mandatory OTP 2FA
    // Return temp token to allow OTP verification
    // Full JWT issued only after OTP verified (in otp.controller.verifyOtp)
    const tempToken = jwt.sign(
      { id: user.id, role: user.role, otp_pending: true },
      process.env.JWT_SECRET,
      { expiresIn: '10m' } // short-lived — OTP must be verified within 10 min
    );

    // Audit log — PRD §25.8
    if (req.auditLog) {
      await req.auditLog('USER_LOGIN_ATTEMPT', { user_id: user.id });
    }

    return success(res, {
      message:    'Password verified. OTP sent to your email.',
      temp_token: tempToken,
      user: {
        id:        user.id,
        email:     user.email,
        full_name: user.full_name,
        role:      user.role,
      },
    });

  } catch (err) {
    console.error('login error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Forgot Password ───────────────────────────────────────────────────────
// PRD §12 POST /api/v1/auth/forgot-password

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return error(res, 'VALIDATION_ERROR', 'Email required', 422);
    }

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

    // Always return success to prevent email enumeration
    if (!user) {
      return success(res, { message: 'If that email exists, an OTP has been sent.' });
    }

    // OTP is sent via otp.controller — trigger from frontend separately
    // Audit log
    if (req.auditLog) {
      await req.auditLog('PASSWORD_RESET_REQUESTED', { user_id: user.id });
    }

    return success(res, {
      message: 'OTP sent to your email for password reset.',
      user_id: user.id,
    });

  } catch (err) {
    console.error('forgotPassword error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Reset Password ────────────────────────────────────────────────────────
// PRD §12 POST /api/v1/auth/reset-password

exports.resetPassword = async (req, res) => {
  try {
    const { user_id, new_password } = req.body;

    if (!user_id || !new_password) {
      return error(res, 'VALIDATION_ERROR', 'user_id and new_password required', 422);
    }

    if (new_password.length < 8) {
      return error(res, 'VALIDATION_ERROR', 'Password must be at least 8 characters', 422);
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return error(res, 'NOT_FOUND', 'User not found', 404);
    }

    // Hash new password — PRD §11 bcrypt 12 rounds
    const password_hash = await bcrypt.hash(new_password, 12);
    await user.update({ password_hash });

    // Audit log — PRD §25.8
    if (req.auditLog) {
      await req.auditLog('PASSWORD_RESET', { user_id: user.id });
    }

    return success(res, { message: 'Password reset successful. Please log in.' });

  } catch (err) {
    console.error('resetPassword error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Get Me ────────────────────────────────────────────────────────────────
// GET /api/v1/auth/me — current authenticated user

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return error(res, 'NOT_FOUND', 'User not found', 404);
    }

    return success(res, { user });

  } catch (err) {
    console.error('getMe error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────
// POST /api/v1/auth/logout

exports.logout = async (req, res) => {
  try {
    // Audit log — PRD §25.8
    if (req.auditLog) {
      await req.auditLog('USER_LOGOUT', { user_id: req.user.id });
    }

    // JWT is stateless — client discards token
    // Future: add token blacklist if needed
    return success(res, { message: 'Logged out successfully.' });

  } catch (err) {
    console.error('logout error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
