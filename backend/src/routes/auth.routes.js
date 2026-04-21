// src/routes/auth.routes.js
require('dotenv').config();
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const Joi     = require('joi');
const prisma  = require('../utils/prisma');

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
      from:    'ZITO (VG Global Logistics) <onboarding@resend.dev>',
      to:      [toEmail],
      subject: 'Your ZITO (VG Global Logistics) Login OTP',
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:32px;
                    background:#f9f9f9;border-radius:12px;border:1px solid #eee;">
          <h2 style="color:#e8a020;margin:0 0 8px;">ZITO (VG Global Logistics)</h2>
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
      from:    'ZITO (VG Global Logistics) <onboarding@resend.dev>',
      to:      [toEmail],
      subject: 'Reset Your ZITO (VG Global Logistics) Password',
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:32px;
                    background:#f9f9f9;border-radius:12px;border:1px solid #eee;">
          <h2 style="color:#e8a020;margin:0 0 8px;">ZITO (VG Global Logistics)</h2>
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

    const existing = await prisma.user.findUnique({ where: { email: value.email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
      });
    }

    const user = await prisma.user.create({
      data: {
        full_name:    value.full_name,
        email:        value.email,
        phone:        value.phone,
        passwordHash: await bcrypt.hash(value.password, 12),
        role:         value.role,
      }
    });

    const { accessToken, refreshToken } = generateTokens(user);

    let driverProfile = null;

    if (user.role === 'driver') {
      const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
      if (driver) {
        driverProfile = { driver_id: driver.id, is_available: driver.isAvailable };
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

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: value.email }, { phone: value.mobile }]
      }
    });

    if (!user || user.deletedAt || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/mobile or password' },
      });
    }

    const isMatch = await bcrypt.compare(value.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/mobile or password' },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    let driverProfile = null;
    if (user.role === 'driver') {
      const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
      if (driver) {
        driverProfile = { driver_id: driver.id, is_available: driver.isAvailable };
      }
    }

    // ✅ Generate and store login OTP
    const contact = value.email ? value.email.trim() : value.mobile.trim();
    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.loginOtp.deleteMany({ where: { contact } });
    await prisma.loginOtp.create({
      data: {
        userId: user.id,
        contact,
        otp,
        expiresAt: expires,
      }
    });

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

    const user = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
    }

    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.loginOtp.deleteMany({ where: { contact: email.trim() } });
    await prisma.loginOtp.create({
      data: {
        userId: user.id,
        contact: email.trim(),
        otp,
        expiresAt: expires
      }
    });

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

    const otpRecord = await prisma.loginOtp.findFirst({
      where: { contact: email.trim(), otp },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    if (new Date(otpRecord.expiresAt) < new Date()) {
      await prisma.loginOtp.delete({ where: { id: otpRecord.id } });
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    await prisma.loginOtp.delete({ where: { id: otpRecord.id } });

    const user = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(new_password, 12) }
    });

    return res.json({ success: true, message: 'Password reset successfully. You can now login.' });

  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

module.exports = router;