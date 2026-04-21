// src/app.js
//
// PRD References:
//   §11  — Security (Helmet, CORS, rate limiting, HTTPS)
//   §12  — API Endpoint Reference
//   §20  — Agent & Agency API Endpoints
//   §22  — On-Trip Help & SOS System
//   §24  — Notification System
//   §25  — Technical Architecture (scalability, response standards)

require('dotenv').config();

/* -------------------------------------------------------------------------- */
/* MODELS — load ONCE, destructure sequelize from the same require            */
/* -------------------------------------------------------------------------- */

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

/* -------------------------------------------------------------------------- */
/* LOGGER — our custom structured logger (replaces raw console.log)          */
/* -------------------------------------------------------------------------- */

const logger = require('./utils/logger');

/* -------------------------------------------------------------------------- */
/* ROUTE IMPORTS                                                               */
/* -------------------------------------------------------------------------- */

const authRoutes        = require('./routes/auth.routes');
const otpRoutes         = require('./routes/otp.routes');
const adminRoutes       = require('./routes/admin.routes');
const customerRoutes    = require('./routes/customer.routes');
const driverRoutes      = require('./routes/driver.routes');
const transporterRoutes = require('./routes/transporter.routes');
const agentRoutes       = require('./routes/agent.routes');
const agencyRoutes      = require('./routes/agency.routes');
const bookingRoutes     = require('./routes/booking.routes');
const vehicleRoutes     = require('./routes/vehicle.routes');
const paymentRoutes     = require('./routes/payment.routes');
const tripChargesRoutes = require('./routes/tripCharges.routes');
const userRoutes        = require('./routes/user.routes');
const contractRoutes    = require('./routes/contract.routes');
const complaintRoutes   = require('./routes/complaint.routes');
const helpRoutes        = require('./routes/help.routes');
const mapRoutes         = require('./routes/map.routes');
const complianceRoutes  = require('./routes/compliance.routes');
const paymentExportRoutes = require('./routes/paymentExport.routes');
const tripChargeExportRoutes = require('./routes/tripChargeExport.routes');
const profileRoutes     = require('./routes/profile.routes');

const app = express();
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

/* -------------------------------------------------------------------------- */
/* SECURITY HEADERS                                                            */
/* PRD §11 — HTTPS enforced, security headers required                        */
/* -------------------------------------------------------------------------- */

app.use(helmet());

/* -------------------------------------------------------------------------- */
/* CORS                                                                        */
/* PRD §11 — production must restrict origins via env var                     */
/* -------------------------------------------------------------------------- */

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser tools (curl/postman) and same-origin server calls
    if (!origin) return callback(null, true);

    // Allow configured origins
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // In development, allow localhost/127.0.0.1 with any port to avoid CORS pain
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

/* -------------------------------------------------------------------------- */
/* BODY PARSER                                                                 */
/* Must come before all routes so req.body is parsed everywhere               */
/* -------------------------------------------------------------------------- */

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* -------------------------------------------------------------------------- */
/* REQUEST LOGGER                                                              */
/* ✅ CHANGED: replaced the old manual console.log block with our logger.    */
/* Works in both dev (colourised) and production (clean JSON for Render).    */
/* Shows: method, url, status code, response time, user_id, user_role        */
/* -------------------------------------------------------------------------- */

app.use(logger.requestMiddleware);

/* -------------------------------------------------------------------------- */
/* RATE LIMITERS                                                               */
/* PRD §11 — brute-force and OTP abuse prevention                             */
/*                                                                             */
/* Two tiers:                                                                  */
/*   authLimiter    — /auth  : 20 req / 15 min  (OTP brute-force)            */
/*   generalLimiter — /api/  : 300 req / 15 min (normal usage)               */
/* -------------------------------------------------------------------------- */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: isDev
        ? 'Too many attempts in dev — wait a moment or restart.'
        : 'Too many attempts. Please try again in 15 minutes.'
    }
  }
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.'
    }
  }
});

app.use('/api/', generalLimiter);
app.use('/api/v1/auth', authLimiter);

/* -------------------------------------------------------------------------- */
/* ROUTES                                                                      */
/* All use consistent singular naming to match PRD §12                        */
/* -------------------------------------------------------------------------- */

// Authentication & OTP — PRD §12 /api/v1/auth/
app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/auth',         otpRoutes);

// Admin portal — PRD §5.1
app.use('/api/v1/admin',        adminRoutes);

// Role portals — PRD §5.2–5.6
app.use('/api/v1/customer',     customerRoutes);
app.use('/api/v1/driver',       driverRoutes);
app.use('/api/v1/transporter',  transporterRoutes);
app.use('/api/v1/agent',        agentRoutes);
app.use('/api/v1/agency',       agencyRoutes);

// Shared resource routes
app.use('/api/v1/booking',      bookingRoutes);
app.use('/api/v1/bookings',     bookingRoutes); // alias for legacy frontend
app.use('/api/v1/vehicle',      vehicleRoutes);
app.use('/api/v1/vehicles',     vehicleRoutes); // alias for legacy frontend
app.use('/api/v1/payment',      paymentRoutes);
app.use('/api/v1/payments',     paymentRoutes); // alias for legacy frontend
app.use('/api/v1/trip-charge',  tripChargesRoutes);
app.use('/api/v1/trip-charges', tripChargesRoutes); // alias for legacy frontend
app.use('/api/v1/user',         userRoutes);
app.use('/api/v1/users',        userRoutes); // alias for legacy frontend
app.use('/api/v1/contract',     contractRoutes);
app.use('/api/v1/contracts',    contractRoutes); // alias for legacy frontend
app.use('/api/v1/complaints',   complaintRoutes);
app.use('/api/v1/help',         helpRoutes);
app.use('/api/v1/map',          mapRoutes);
app.use('/api/v1/compliance',   complianceRoutes);
app.use('/api/v1/export',       paymentExportRoutes);
app.use('/api/v1/export',       tripChargeExportRoutes);
app.use('/api/v1/profile',      profileRoutes);

// Expose getter for socket.io (set in server.js)
app.set('getIO', () => app.get('io'));

/* -------------------------------------------------------------------------- */
/* HEALTH CHECK                                                                */
/* -------------------------------------------------------------------------- */

app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await sequelize.authenticate();
  } catch {
    dbStatus = 'error';
  }

  const httpStatus = dbStatus === 'ok' ? 200 : 503;
  res.status(httpStatus).json({
    success:     dbStatus === 'ok',
    message:     'ZITO API',
    version:     process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
    services: {
      api:      'ok',
      database: dbStatus
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 404 HANDLER                                                                 */
/* -------------------------------------------------------------------------- */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code:    'NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`
    }
  });
});

/* -------------------------------------------------------------------------- */
/* GLOBAL ERROR HANDLER                                                        */
/* PRD §25.10 — standard error response envelope                              */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(`${req.method} ${req.url} — unhandled error`, err);

  const statusCode = err.status || err.statusCode || 500;
  const errorCode  = err.code   || 'SERVER_ERROR';

  const response = {
    success: false,
    error: {
      code:    errorCode,
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message
    },
    timestamp: new Date().toISOString()
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

module.exports = app;
