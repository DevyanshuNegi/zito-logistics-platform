// src/app.js
//
// PRD References:
//   §11  — Security (Helmet, CORS, rate limiting, HTTPS)
//   §12  — API Endpoint Reference
//   §20  — Agent & Agency API Endpoints
//   §22  — On-Trip Help & SOS System
//   §24  — Notification System
//   §25  — Technical Architecture (scalability, response standards)
//   Gap 7 — Multi-tenant isolation
//   Gap 10 — Pagination, background jobs, API response standards

require('dotenv').config();

/* -------------------------------------------------------------------------- */
/* MODELS — load ONCE, destructure sequelize from the same require            */
/* Fix: Issue 1 — was loaded twice (require + destructure separately)         */
/* -------------------------------------------------------------------------- */

const { sequelize } = require('./models'); // loads all models + associations

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

/* -------------------------------------------------------------------------- */
/* ROUTE IMPORTS                                                               */
/* PRD §12, §20 — all role portals and shared resources                       */
/* -------------------------------------------------------------------------- */

const authRoutes        = require('./routes/auth.routes');
const otpRoutes         = require('./routes/otp.routes');
const adminRoutes       = require('./routes/admin.routes');        // PRD §5.1, §12, §25.4
const customerRoutes    = require('./routes/customer.routes');     // PRD §5.2, §12
const driverRoutes      = require('./routes/driver.routes');       // PRD §5.3, §12
const transporterRoutes = require('./routes/transporter.routes'); // PRD §5.4, §12
const agentRoutes       = require('./routes/agent.routes');        // PRD §5.5, §20
const agencyRoutes      = require('./routes/agency.routes');       // PRD §5.6, §20
const bookingRoutes     = require('./routes/booking.routes');      // PRD §6, §12
const vehicleRoutes     = require('./routes/vehicle.routes');      // PRD §8, §12
const paymentRoutes     = require('./routes/payment.routes');      // PRD §25.6
const tripChargesRoutes = require('./routes/tripCharges.routes');
const userRoutes        = require('./routes/user.routes');
const contractRoutes    = require('./routes/contract.routes');

const app = express();

/* -------------------------------------------------------------------------- */
/* SECURITY HEADERS                                                           */
/* PRD §11 — HTTPS enforced, security headers required                       */
/* -------------------------------------------------------------------------- */

app.use(helmet());

/* -------------------------------------------------------------------------- */
/* CORS                                                                       */
/* PRD §11 — production must restrict origins via env var                    */
/* -------------------------------------------------------------------------- */

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : '*',
  credentials: true
}));

/* -------------------------------------------------------------------------- */
/* BODY PARSER                                                                */
/* Must come before all routes so req.body is parsed everywhere              */
/* -------------------------------------------------------------------------- */

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* -------------------------------------------------------------------------- */
/* REQUEST LOGGER (development only)                                          */
/* -------------------------------------------------------------------------- */

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

/* -------------------------------------------------------------------------- */
/* RATE LIMITERS                                                              */
/* PRD §11 — brute-force and OTP abuse prevention                            */
/*                                                                            */
/* Two tiers:                                                                 */
/*   authLimiter    — /auth  : 20 req / 15 min  (OTP brute-force)           */
/*   generalLimiter — /api/  : 300 req / 15 min (normal usage)              */
/* -------------------------------------------------------------------------- */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please try again in 15 minutes.'
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
app.use('/api/v1/auth', authLimiter); // stricter on auth endpoints

/* -------------------------------------------------------------------------- */
/* ROUTES                                                                     */
/*                                                                            */
/* Fix: Issue 3 — ALL routes now use consistent singular naming:             */
/*   /api/v1/driver    (not /drivers)                                        */
/*   /api/v1/vehicle   (not /vehicles)                                       */
/*   /api/v1/booking   (not /bookings)                                       */
/*   /api/v1/payment   (not /payments)                                       */
/*   /api/v1/user      (not /users)                                          */
/*   /api/v1/contract  (not /contracts)                                      */
/*                                                                            */
/* This matches PRD §12 endpoint definitions and prevents                   */
/* frontend confusion from mixed singular/plural route naming.               */
/* -------------------------------------------------------------------------- */

// Authentication & OTP — PRD §12 /api/v1/auth/
app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/auth',         otpRoutes);

// Admin portal — PRD §5.1, §12, §25.4
app.use('/api/v1/admin',        adminRoutes);

// Role-specific portals — PRD §5.2–5.6, §12, §20
app.use('/api/v1/customer',     customerRoutes);
app.use('/api/v1/driver',       driverRoutes);
app.use('/api/v1/transporter',  transporterRoutes);
app.use('/api/v1/agent',        agentRoutes);
app.use('/api/v1/agency',       agencyRoutes);

// Shared resource routes — consistent singular naming
app.use('/api/v1/booking',      bookingRoutes);
app.use('/api/v1/vehicle',      vehicleRoutes);
app.use('/api/v1/payment',      paymentRoutes);
app.use('/api/v1/trip-charge',  tripChargesRoutes);
app.use('/api/v1/user',         userRoutes);
app.use('/api/v1/contract',     contractRoutes);

/* -------------------------------------------------------------------------- */
/* HEALTH CHECK                                                               */
/* Returns DB connectivity status — returns 503 if DB is unreachable        */
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
    success: dbStatus === 'ok',
    message: 'VG Logistics API',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    services: {
      api:      'ok',
      database: dbStatus
    }
  });
});

/* -------------------------------------------------------------------------- */
/* SOCKET.IO — Issue 4 NOTE                                                  */
/*                                                                            */
/* Socket.io is intentionally NOT initialised here.                          */
/* It is attached to the HTTP server in server.js, NOT in app.js.           */
/*                                                                            */
/* Reason: app.js exports an Express app (for testing + modularity).        */
/* Socket requires the raw http.Server instance which only exists in         */
/* server.js after: const server = http.createServer(app)                   */
/*                                                                            */
/* PRD §22 — On-Trip Help & SOS real-time events use socket.                */
/* PRD §24 — In-app push notifications use socket.                          */
/*                                                                            */
/* In server.js:                                                             */
/*   const { createServer } = require('http');                               */
/*   const { initSocket }   = require('./socket');                           */
/*   const server = createServer(app);                                       */
/*   initSocket(server);                                                     */
/*   server.listen(PORT);                                                    */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* 404 HANDLER                                                                */
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
/* GLOBAL ERROR HANDLER                                                       */
/* PRD §25.10 — standard error response envelope                             */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ ERROR:', {
    message:   err.message,
    code:      err.code,
    stack:     err.stack,
    url:       req.url,
    method:    req.method,
    timestamp: new Date().toISOString()
  });

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