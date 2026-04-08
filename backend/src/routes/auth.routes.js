// src/routes/auth.routes.js
require('dotenv').config();
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const Joi     = require('joi');
const { User, Driver } = require('../models');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

// ─── Token generator ──────────────────────────────────────────────────────────

const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role, email: user.email };
  const secret  = 'vglogistics_access_secret_key_2026_make_this_very_long_and_random';
  const opts    = { expiresIn: '30d' };

  return {
    accessToken:  jwt.sign(payload,       secret, opts),
    refreshToken: jwt.sign({ id: user.id }, secret, opts),
  };
};

// ─── LOGIN OTP email (used only during login 2FA) ────────────────────────────

async function sendLoginOTPEmail(toEmail, otp) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[LOGIN OTP DEV] No RESEND_API_KEY — OTP for ${toEmail} = ${otp}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'VG Logistics <onboarding@resend.dev>',
      to:      [toEmail],
      subject: 'Your VG Logistics Login OTP',
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:32px;
                    background:#f9f9f9;border-radius:12px;border:1px solid #eee;">
          <h2 style="color:#e8a020;margin:0 0 8px;">VG Logistics</h2>
          <p style="color:#555;margin:0 0 24px;font-size:14px;">
            Use the OTP below to complete your login.<br/>
            Valid for <strong>10 minutes</strong> — one-time use only.
          </p>
          <div style="font-size:38px;font-weight:800;letter-spacing:12px;color:#181e2d;
                      background:#fff;padding:20px;border-radius:8px;text-align:center;
                      border:2px dashed #e8a020;">
            ${otp}
          </div>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">
            If you did not attempt to login, please ignore this email.
          </p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

// ─── RESET PASSWORD email (used only for forgot-password) ────────────────────

async function sendResetEmail(toEmail, otp) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[RESET DEV] No RESEND_API_KEY — reset OTP for ${toEmail} = ${otp}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'VG Logistics <onboarding@resend.dev>',
      to:      [toEmail],
      subject: 'Reset Your VG Logistics Password',
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:32px;
                    background:#f9f9f9;border-radius:12px;border:1px solid #eee;">
          <h2 style="color:#e8a020;margin:0 0 8px;">VG Logistics</h2>
          <p style="color:#555;margin:0 0 24px;font-size:14px;">
            You requested a password reset. Use the OTP below.<br/>
            Valid for <strong>10 minutes</strong> — one-time use only.
          </p>
          <div style="font-size:38px;font-weight:800;letter-spacing:12px;color:#181e2d;
                      background:#fff;padding:20px;border-radius:8px;text-align:center;
                      border:2px dashed #e8a020;">
            ${otp}
          </div>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">
            If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const schema = Joi.object({
      full_name: Joi.string().min(3).required(),
      email:     Joi.string().email().required(),
      phone:     Joi.string().min(10).required(),
      password:  Joi.string().min(6).required(),
      role:      Joi.string().valid('super_admin', 'admin', 'customer', 'agent', 'driver', 'transporter').default('customer'),
    }).options({ allowUnknown: true });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
      });
    }

    const existing = await User.findOne({ where: { email: value.email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
      });
    }

    const user = await User.create({
      full_name:     value.full_name,
      email:         value.email,
      phone:         value.phone,
      password_hash: value.password,
      role:          value.role,
    });

    const { accessToken, refreshToken } = generateTokens(user);

    let driverProfile = null;

    if (user.role === 'driver') {
      const driver = await Driver.findOne({ where: { user_id: user.id } });
      if (driver) {
        driverProfile = { driver_id: driver.id, is_available: driver.is_available };
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
        driver: driverProfile,
        accessToken,
        refreshToken,
      },
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message },
    });
  }
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const schema = Joi.object({
      email:    Joi.string().email(),
      mobile:   Joi.string().min(10),
      password: Joi.string().required(),
    }).or('email', 'mobile');

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
      });
    }

    let user;
    if (value.email) {
      user = await User.scope('withPassword').findOne({ where: { email: value.email } });
    } else {
      user = await User.scope('withPassword').findOne({ where: { phone: value.mobile } });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/mobile or password' },
      });
    }

    const isMatch = await user.comparePassword(value.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/mobile or password' },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    let driverProfile = null;
    if (user.role === 'driver') {
      const driver = await Driver.findOne({ where: { user_id: user.id } });
      if (driver) {
        driverProfile = { driver_id: driver.id, is_available: driver.is_available };
      }
    }

    // ✅ Generate and store login OTP
    const contact = value.email ? value.email.trim() : value.mobile.trim();
    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await sequelize.query(
      `DELETE FROM login_otps WHERE contact = :contact`,
      { replacements: { contact }, type: QueryTypes.DELETE }
    );
    await sequelize.query(
      `INSERT INTO login_otps (contact, otp, expires_at) VALUES (:contact, :otp, :expires)`,
      { replacements: { contact, otp, expires }, type: QueryTypes.INSERT }
    );

    // ✅ Send LOGIN OTP email (NOT reset password email)
    if (value.email) {
      sendLoginOTPEmail(contact, otp)
        .then(() => console.log(`[LOGIN OTP] sent to ${contact}`))
        .catch(err => console.error(`[LOGIN OTP ERROR] ${err.message} — OTP=${otp}`));
    }

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
        driver: driverProfile,
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message },
    });
  }
});

// ─── POST /api/v1/auth/forgot-password ───────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ where: { email: email.trim() } });
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
    }

    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await sequelize.query(
      `DELETE FROM login_otps WHERE contact = :email`,
      { replacements: { email: email.trim() }, type: QueryTypes.DELETE }
    );
    await sequelize.query(
      `INSERT INTO login_otps (contact, otp, expires_at) VALUES (:email, :otp, :expires)`,
      { replacements: { email: email.trim(), otp, expires }, type: QueryTypes.INSERT }
    );

    res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });

    // ✅ Send RESET PASSWORD email (not login OTP email)
    sendResetEmail(email.trim(), otp)
      .then(() => console.log(`[RESET] Email sent to: ${email}`))
      .catch(err => console.error(`[RESET] Email failed: ${err.message} — OTP = ${otp}`));

  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ─── POST /api/v1/auth/reset-password ────────────────────────────────────────

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;

    if (!email || !otp || !new_password) {
      return res.status(400).json({ success: false, message: 'Email, OTP and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const rows = await sequelize.query(
      `SELECT * FROM login_otps WHERE contact = :email AND otp = :otp ORDER BY created_at DESC LIMIT 1`,
      { replacements: { email: email.trim(), otp }, type: QueryTypes.SELECT }
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    if (new Date(rows[0].expires_at) < new Date()) {
      await sequelize.query(`DELETE FROM login_otps WHERE id = :id`, { replacements: { id: rows[0].id }, type: QueryTypes.DELETE });
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    await sequelize.query(`DELETE FROM login_otps WHERE id = :id`, { replacements: { id: rows[0].id }, type: QueryTypes.DELETE });

    const user = await User.findOne({ where: { email: email.trim() } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.password_hash = new_password;
    await user.save();

    return res.json({ success: true, message: 'Password reset successfully. You can now login.' });

  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

module.exports = router;
