// src/utils/logger.js
//
// Lightweight structured logger for ZITO backend.
// Outputs clean JSON in production (Railway log aggregation),
// and colourised human-readable text in development.
//
// Usage anywhere in the codebase:
//   const logger = require('../utils/logger');
//   logger.info('Booking created', { booking_id, customer_id });
//   logger.error('Payment failed', err);
//   logger.warn('Driver near expiry', { driver_id, doc: 'police_clearance' });
// ─────────────────────────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === 'production';

/* ── ANSI colour codes (dev only) ───────────────────────────── */
const COLOURS = {
  reset:  '\x1b[0m',
  grey:   '\x1b[90m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  magenta:'\x1b[35m',
};

const LEVEL_COLOURS = {
  debug: COLOURS.grey,
  info:  COLOURS.cyan,
  warn:  COLOURS.yellow,
  error: COLOURS.red,
  audit: COLOURS.magenta,
};

/* ── Core log function ──────────────────────────────────────── */

const log = (level, message, meta = null) => {
  const ts = new Date().toISOString();

  if (isProd) {
    // JSON format — Railway, Datadog, Papertrail can parse structured logs
    const entry = {
      ts,
      level,
      message,
      service: 'zito-api',
      env:     process.env.NODE_ENV,
    };
    if (meta) {
      if (meta instanceof Error) {
        entry.error = { message: meta.message, stack: meta.stack, name: meta.name };
      } else {
        entry.meta = meta;
      }
    }
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    // Human-readable colourised output for local development
    const colour  = LEVEL_COLOURS[level] || COLOURS.reset;
    const prefix  = `${COLOURS.grey}${ts}${COLOURS.reset} ${colour}[${level.toUpperCase()}]${COLOURS.reset}`;
    let   metaStr = '';

    if (meta) {
      if (meta instanceof Error) {
        metaStr = `\n${COLOURS.red}${meta.stack}${COLOURS.reset}`;
      } else if (typeof meta === 'object') {
        metaStr = `\n  ${COLOURS.grey}${JSON.stringify(meta, null, 2)}${COLOURS.reset}`;
      } else {
        metaStr = ` ${meta}`;
      }
    }

    process.stdout.write(`${prefix} ${message}${metaStr}\n`);
  }
};

/* ============================================================
   PUBLIC API
   ============================================================ */

const logger = {

  /** General debugging — disabled in production */
  debug: (message, meta = null) => {
    if (!isProd) log('debug', message, meta);
  },

  /** Normal informational events — booking created, user logged in, etc. */
  info: (message, meta = null) => log('info', message, meta),

  /** Non-fatal issues — expiring docs, retry attempts, degraded services */
  warn: (message, meta = null) => log('warn', message, meta),

  /** Errors that need attention — caught exceptions, failed DB ops, etc. */
  error: (message, metaOrError = null) => log('error', message, metaOrError),

  /**
   * Audit-level events — sensitive actions that must always be logged.
   * Mirrors the DB audit log but goes to stdout as well.
   * PRD §25.8 — immutable audit log for sensitive actions.
   */
  audit: (action, details = {}) => log('audit', action, details),

  /**
   * HTTP request logger middleware — attach in app.js.
   * Usage: app.use(logger.requestMiddleware)
   */
  requestMiddleware: (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const ms     = Date.now() - start;
      const status = res.statusCode;
      const level  = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

      log(level, `${req.method} ${req.originalUrl} ${status} ${ms}ms`, {
        method:     req.method,
        url:        req.originalUrl,
        status,
        duration_ms: ms,
        ip:         req.ip || req.headers['x-forwarded-for'],
        user_id:    req.user?.id   || null,
        user_role:  req.user?.role || null,
      });
    });

    next();
  },
};

module.exports = logger;