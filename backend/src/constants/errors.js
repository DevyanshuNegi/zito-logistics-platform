// ─────────────────────────────────────────────────────────────
//  ZITO · Error Constants
//  Centralised error codes and messages used across all
//  controllers, services, and middleware.
// ─────────────────────────────────────────────────────────────

/**
 * Structured error definitions.
 * Each entry: { code, message, httpStatus }
 *
 * Usage in a controller:
 *   const { ERRORS } = require('../constants/errors');
 *   return res.status(ERRORS.NOT_FOUND.httpStatus).json({
 *     success: false,
 *     error: ERRORS.NOT_FOUND.code,
 *     message: ERRORS.NOT_FOUND.message,
 *   });
 */

const ERRORS = {

  // ── Generic ────────────────────────────────────────────────
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    httpStatus: 404,
  },
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    httpStatus: 500,
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'One or more input fields are invalid.',
    httpStatus: 422,
  },
  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    message: 'The request is malformed or missing required fields.',
    httpStatus: 400,
  },
  METHOD_NOT_ALLOWED: {
    code: 'METHOD_NOT_ALLOWED',
    message: 'HTTP method not allowed on this endpoint.',
    httpStatus: 405,
  },

  // ── Authentication ─────────────────────────────────────────
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required. Please log in.',
    httpStatus: 401,
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Email or password is incorrect.',
    httpStatus: 401,
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Your session has expired. Please log in again.',
    httpStatus: 401,
  },
  TOKEN_INVALID: {
    code: 'TOKEN_INVALID',
    message: 'Invalid or malformed authentication token.',
    httpStatus: 401,
  },
  OTP_INVALID: {
    code: 'OTP_INVALID',
    message: 'The OTP entered is incorrect.',
    httpStatus: 401,
  },
  OTP_EXPIRED: {
    code: 'OTP_EXPIRED',
    message: 'The OTP has expired. Please request a new one.',
    httpStatus: 401,
  },
  OTP_REQUIRED: {
    code: 'OTP_REQUIRED',
    message: 'OTP verification is required to complete this action.',
    httpStatus: 403,
  },

  // ── Authorisation / RBAC ───────────────────────────────────
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
    httpStatus: 403,
  },
  ROLE_NOT_PERMITTED: {
    code: 'ROLE_NOT_PERMITTED',
    message: 'Your role does not have access to this resource.',
    httpStatus: 403,
  },
  ACCOUNT_DEACTIVATED: {
    code: 'ACCOUNT_DEACTIVATED',
    message: 'Your account has been deactivated. Contact support.',
    httpStatus: 403,
  },
  ACCOUNT_BLACKLISTED: {
    code: 'ACCOUNT_BLACKLISTED',
    message: 'Your account has been blacklisted. Contact support.',
    httpStatus: 403,
  },
  DATA_LOCKED: {
    code: 'DATA_LOCKED',
    message: 'This field is locked after compliance approval and cannot be changed.',
    httpStatus: 403,
  },

  // ── User ───────────────────────────────────────────────────
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'User not found.',
    httpStatus: 404,
  },
  EMAIL_ALREADY_EXISTS: {
    code: 'EMAIL_ALREADY_EXISTS',
    message: 'An account with this email address already exists.',
    httpStatus: 409,
  },
  PHONE_ALREADY_EXISTS: {
    code: 'PHONE_ALREADY_EXISTS',
    message: 'An account with this phone number already exists.',
    httpStatus: 409,
  },

  // ── Driver ─────────────────────────────────────────────────
  DRIVER_NOT_FOUND: {
    code: 'DRIVER_NOT_FOUND',
    message: 'Driver not found.',
    httpStatus: 404,
  },
  DRIVER_NOT_APPROVED: {
    code: 'DRIVER_NOT_APPROVED',
    message: 'Driver compliance has not been approved. Cannot be assigned.',
    httpStatus: 403,
  },
  DRIVER_BLACKLISTED: {
    code: 'DRIVER_BLACKLISTED',
    message: 'Driver is blacklisted and cannot receive assignments.',
    httpStatus: 403,
  },
  DRIVER_UNAVAILABLE: {
    code: 'DRIVER_UNAVAILABLE',
    message: 'Driver is not available for assignment.',
    httpStatus: 409,
  },
  DRIVER_HAS_ACTIVE_TRIP: {
    code: 'DRIVER_HAS_ACTIVE_TRIP',
    message: 'Driver already has an active trip and cannot be assigned.',
    httpStatus: 409,
  },
  DRIVER_CANNOT_RECEIVE_ASSIGNMENTS: {
    code: 'DRIVER_CANNOT_RECEIVE_ASSIGNMENTS',
    message: 'Driver is blocked from receiving assignments.',
    httpStatus: 403,
  },
  DRIVER_DOCUMENTS_EXPIRED: {
    code: 'DRIVER_DOCUMENTS_EXPIRED',
    message: 'One or more driver compliance documents have expired.',
    httpStatus: 403,
  },

  // ── Vehicle ────────────────────────────────────────────────
  VEHICLE_NOT_FOUND: {
    code: 'VEHICLE_NOT_FOUND',
    message: 'Vehicle not found.',
    httpStatus: 404,
  },
  VEHICLE_NOT_VERIFIED: {
    code: 'VEHICLE_NOT_VERIFIED',
    message: 'Vehicle has not been verified and cannot be assigned.',
    httpStatus: 403,
  },
  VEHICLE_ASSIGNMENT_BLOCKED: {
    code: 'VEHICLE_ASSIGNMENT_BLOCKED',
    message: 'Vehicle is blocked from assignments due to expired documents.',
    httpStatus: 403,
  },
  VEHICLE_TYPE_MISMATCH: {
    code: 'VEHICLE_TYPE_MISMATCH',
    message: 'Vehicle type does not match the booking requirement.',
    httpStatus: 409,
  },
  VEHICLE_CAPACITY_EXCEEDED: {
    code: 'VEHICLE_CAPACITY_EXCEEDED',
    message: 'Cargo weight exceeds vehicle capacity.',
    httpStatus: 409,
  },

  // ── Booking ────────────────────────────────────────────────
  BOOKING_NOT_FOUND: {
    code: 'BOOKING_NOT_FOUND',
    message: 'Booking not found.',
    httpStatus: 404,
  },
  BOOKING_ALREADY_ASSIGNED: {
    code: 'BOOKING_ALREADY_ASSIGNED',
    message: 'This booking already has an assigned driver.',
    httpStatus: 409,
  },
  BOOKING_NOT_ASSIGNABLE: {
    code: 'BOOKING_NOT_ASSIGNABLE',
    message: 'Booking is not in a state that allows driver assignment.',
    httpStatus: 409,
  },
  BOOKING_ALREADY_CANCELLED: {
    code: 'BOOKING_ALREADY_CANCELLED',
    message: 'This booking has already been cancelled.',
    httpStatus: 409,
  },
  BOOKING_TERMINAL_STATE: {
    code: 'BOOKING_TERMINAL_STATE',
    message: 'This booking is in a terminal state and cannot be modified.',
    httpStatus: 409,
  },
  INVALID_STATUS_TRANSITION: {
    code: 'INVALID_STATUS_TRANSITION',
    message: 'This status transition is not permitted.',
    httpStatus: 409,
  },
  PAYMENT_REQUIRED_TO_COMPLETE: {
    code: 'PAYMENT_REQUIRED_TO_COMPLETE',
    message: 'Payment must be confirmed before the booking can be completed.',
    httpStatus: 402,
  },
  RATING_WINDOW_EXPIRED: {
    code: 'RATING_WINDOW_EXPIRED',
    message: 'The 48-hour rating window for this trip has expired.',
    httpStatus: 403,
  },
  ALREADY_RATED: {
    code: 'ALREADY_RATED',
    message: 'This booking has already been rated.',
    httpStatus: 409,
  },

  // ── Compliance ─────────────────────────────────────────────
  COMPLIANCE_PENDING: {
    code: 'COMPLIANCE_PENDING',
    message: 'Account compliance is pending Admin review.',
    httpStatus: 403,
  },
  COMPLIANCE_REJECTED: {
    code: 'COMPLIANCE_REJECTED',
    message: 'Compliance application was rejected. Please resubmit.',
    httpStatus: 403,
  },
  COMPLIANCE_RESUBMISSION_REQUIRED: {
    code: 'COMPLIANCE_RESUBMISSION_REQUIRED',
    message: 'Resubmission of certain documents is required.',
    httpStatus: 403,
  },

  // ── Payment ────────────────────────────────────────────────
  PAYMENT_NOT_FOUND: {
    code: 'PAYMENT_NOT_FOUND',
    message: 'Payment record not found.',
    httpStatus: 404,
  },
  PAYMENT_FAILED: {
    code: 'PAYMENT_FAILED',
    message: 'Payment initiation failed. Please try again.',
    httpStatus: 502,
  },
  PAYMENT_ALREADY_COMPLETED: {
    code: 'PAYMENT_ALREADY_COMPLETED',
    message: 'This booking has already been paid.',
    httpStatus: 409,
  },
  CREDIT_LIMIT_EXCEEDED: {
    code: 'CREDIT_LIMIT_EXCEEDED',
    message: 'Credit limit exceeded. Settle outstanding balance to continue.',
    httpStatus: 402,
  },

  // ── Contract ───────────────────────────────────────────────
  CONTRACT_NOT_FOUND: {
    code: 'CONTRACT_NOT_FOUND',
    message: 'Contract not found.',
    httpStatus: 404,
  },
  CONTRACT_INACTIVE: {
    code: 'CONTRACT_INACTIVE',
    message: 'Contract is not active.',
    httpStatus: 409,
  },

  // ── Offer / Marketplace ────────────────────────────────────
  OFFER_NOT_FOUND: {
    code: 'OFFER_NOT_FOUND',
    message: 'Bid offer not found.',
    httpStatus: 404,
  },
  OFFER_EXPIRED: {
    code: 'OFFER_EXPIRED',
    message: 'This bid offer has expired.',
    httpStatus: 409,
  },
  OFFER_ALREADY_RESPONDED: {
    code: 'OFFER_ALREADY_RESPONDED',
    message: 'This offer has already been accepted or rejected.',
    httpStatus: 409,
  },
  DUPLICATE_BID: {
    code: 'DUPLICATE_BID',
    message: 'You have already submitted a bid on this booking.',
    httpStatus: 409,
  },

  // ── Rate Limiting ──────────────────────────────────────────
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please slow down and try again later.',
    httpStatus: 429,
  },
};

/**
 * Helper: build a standard error response object.
 * Usage: res.status(err.httpStatus).json(buildError(err, 'optional extra detail'));
 */
const buildError = (error, detail = null) => ({
  success: false,
  error: error.code,
  message: error.message,
  ...(detail && { detail }),
});

module.exports = { ERRORS, buildError };