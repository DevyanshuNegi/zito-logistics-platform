// src/utils/response.js
//
// Standard API response helpers.
// Every controller uses these — never build raw res.json() objects.
// Matches the envelope shape used in auth.js and app.js error handlers:
//   { success, message?, data?, error?, meta?, timestamp }
// ─────────────────────────────────────────────────────────────────────────────

/* ============================================================
   SUCCESS RESPONSES
   ============================================================ */

/**
 * 200 OK — data fetch or update succeeded.
 * @param {Response} res
 * @param {*}        data     — payload (object or array)
 * @param {string}   message  — human-readable summary
 * @param {object}   meta     — pagination, counts, extras
 */
const ok = (res, data = null, message = 'Success', meta = null) => {
  const body = { success: true, message };
  if (data  !== null) body.data = data;
  if (meta  !== null) body.meta = meta;
  body.timestamp = new Date().toISOString();
  return res.status(200).json(body);
};

// Backward compatibility alias (many controllers import { success })
const success = ok;

/**
 * 201 Created — new resource created.
 */
const created = (res, data = null, message = 'Created successfully') => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  body.timestamp = new Date().toISOString();
  return res.status(201).json(body);
};

/**
 * 204 No Content — action succeeded, nothing to return.
 * (e.g. delete, toggle)
 */
const noContent = (res) => res.status(204).send();

/* ============================================================
   ERROR RESPONSES
   ============================================================ */

/**
 * Generic error — pass an HTTP status + error details.
 * @param {Response} res
 * @param {number}   status   — HTTP status code
 * @param {string}   code     — machine-readable error code (SCREAMING_SNAKE)
 * @param {string}   message  — human-readable message
 * @param {*}        details  — optional extra context (array, object)
 */
const error = (res, status, code, message, details = null) => {
  // Backward-compat: many callers mistakenly pass (res, code, message, status)
  // Normalise so status is always a number.
  if (typeof status !== 'number') {
    const legacyCode    = status;
    const legacyMessage = code;
    const legacyStatus  = typeof message === 'number' ? message
                        : typeof details === 'number' ? details
                        : 500;
    status  = legacyStatus;
    code    = legacyCode || 'SERVER_ERROR';
    message = legacyMessage || 'Internal server error';
    if (typeof details === 'number') details = null;
  }

  const body = {
    success: false,
    error: { code, message },
  };
  if (details !== null) body.error.details = details;
  body.timestamp = new Date().toISOString();
  return res.status(status).json(body);
};

// ── Shorthand error helpers ────────────────────────────────────────────────

/** 400 Bad Request */
const badRequest = (res, message = 'Bad request', details = null) =>
  error(res, 400, 'BAD_REQUEST', message, details);

/** 401 Unauthorized */
const unauthorized = (res, message = 'Authentication required') =>
  error(res, 401, 'UNAUTHORIZED', message);

/** 403 Forbidden */
const forbidden = (res, message = 'You do not have permission to perform this action') =>
  error(res, 403, 'FORBIDDEN', message);

/** 404 Not Found */
const notFound = (res, resource = 'Resource') =>
  error(res, 404, 'NOT_FOUND', `${resource} not found`);

/** 409 Conflict */
const conflict = (res, message = 'Conflict with current state') =>
  error(res, 409, 'CONFLICT', message);

/** 422 Validation Error */
const validationError = (res, details = []) =>
  error(res, 422, 'VALIDATION_ERROR', 'One or more input fields are invalid.', details);

/** 429 Rate Limit */
const rateLimited = (res, message = 'Too many requests. Please try again later.') =>
  error(res, 429, 'RATE_LIMITED', message);

/** 500 Internal Server Error */
const serverError = (res, err = null) => {
  if (err) console.error('❌ Server error:', err?.message || err);
  return error(
    res, 500, 'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : (err?.message || 'Internal server error'),
  );
};

/* ============================================================
   PAGINATED LIST HELPER
   Builds the standard meta block for list endpoints.
   PRD §25 — all list endpoints return paginated results.
              Default page size: 20. Maximum: 100.

   Usage in a controller:
     const { rows, count } = await Model.findAndCountAll({ ... });
     return paginated(res, rows, count, page, limit);
   ============================================================ */

const paginated = (res, rows, count, page, limit, message = 'Success') => {
  const totalPages = Math.ceil(count / limit);
  return ok(res, rows, message, {
    total:        count,
    page:         Number(page),
    limit:        Number(limit),
    total_pages:  totalPages,
    has_next:     page < totalPages,
    has_prev:     page > 1,
  });
};

/* ============================================================
   FROM ERRORS CONSTANT
   Convenience wrapper — pass an ERRORS constant directly.

   Usage:
     const { ERRORS } = require('../constants/errors');
     return fromError(res, ERRORS.BOOKING_NOT_FOUND);
     return fromError(res, ERRORS.DRIVER_BLACKLISTED, 'Additional context here');
   ============================================================ */

const fromError = (res, errConst, detail = null) =>
  error(res, errConst.httpStatus, errConst.code, errConst.message, detail);

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  // Success
  success,
  ok,
  created,
  noContent,
  paginated,

  // Errors — shorthand
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  rateLimited,
  serverError,

  // Generic + from constant
  error,
  fromError,
};
