// ─────────────────────────────────────────────────────────────
//  ZITO · Booking Status Constants
//  Canonical status values used across models, controllers,
//  services, and validation layers.
// ─────────────────────────────────────────────────────────────

/**
 * Full booking lifecycle statuses (in order of progression).
 * These are the only valid values for bookings.status.
 */
const BOOKING_STATUS = {
  // Customer / Agent / Transporter creates booking → awaits Admin review
  PENDING: 'pending',

  // Admin approves booking → ready for driver assignment
  APPROVED: 'approved',

  // Admin / Assignment Engine assigns driver + vehicle
  ASSIGNED: 'assigned',

  // Driver confirms they will take the trip
  ACCEPTED: 'accepted',

  // Driver has collected the cargo from pickup location
  PICKED_UP: 'picked_up',

  // Driver is en route to delivery address
  IN_TRANSIT: 'in_transit',

  // Cargo delivered; POD uploaded (if required)
  DELIVERED: 'delivered',

  // Awaiting payment confirmation (postpaid flow)
  PAYMENT_PENDING: 'payment_pending',

  // Payment confirmed; trip fully closed
  COMPLETED: 'completed',

  // Booking cancelled (before or after assignment)
  CANCELLED: 'cancelled',

  // Booking or assignment rejected by Admin or Driver
  REJECTED: 'rejected',
};

/**
 * Payment status values used in bookings.payment_status.
 */
const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  AWAITING_PAYMENT: 'awaiting_payment',
  REFUNDED: 'refunded',
  FROZEN: 'frozen',
};

/**
 * Payment methods accepted by the platform.
 */
const PAYMENT_METHOD = {
  MPESA: 'mpesa',
  BANK_TRANSFER: 'bank_transfer',
  CREDIT: 'credit',       // Admin-approved credit customers only
  ADVANCE: 'advance',     // Pre-payment before trip starts
};

/**
 * Trip charge types — additional charges added during/after trip execution.
 */
const CHARGE_TYPE = {
  TOLL: 'toll',
  FUEL: 'fuel',
  LOADING: 'loading',
  UNLOADING: 'unloading',
  WAITING: 'waiting',
  DRIVER_EXPENSE: 'driver_expense',
  OTHER: 'other',
};

/**
 * Offer / bid statuses used in booking_offers.
 */
const OFFER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  COUNTERED: 'countered',
};

/**
 * Which entity operationally handles the booking.
 * Used in bookings.handled_by.
 */
const HANDLED_BY = {
  ADMIN: 'admin',
  TRANSPORTER: 'transporter',
};

/**
 * Statuses where the booking is still active / in-flight.
 * Useful for conflict checks (e.g., driver already has an active trip).
 */
const ACTIVE_BOOKING_STATUSES = [
  BOOKING_STATUS.APPROVED,
  BOOKING_STATUS.ASSIGNED,
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.PICKED_UP,
  BOOKING_STATUS.IN_TRANSIT,
  BOOKING_STATUS.DELIVERED,
  BOOKING_STATUS.PAYMENT_PENDING,
];

/**
 * Terminal statuses — booking can no longer be modified.
 */
const TERMINAL_BOOKING_STATUSES = [
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.REJECTED,
];

const PAYABLE_STATUSES = [
  BOOKING_STATUS.DELIVERED,
  BOOKING_STATUS.COMPLETED,
];

/**
 * Statuses that a Driver is allowed to transition to.
 * Driver cannot skip steps or move backwards.
 */
const DRIVER_ALLOWED_TRANSITIONS = {
  [BOOKING_STATUS.ASSIGNED]: BOOKING_STATUS.ACCEPTED,
  [BOOKING_STATUS.ACCEPTED]: BOOKING_STATUS.PICKED_UP,
  [BOOKING_STATUS.PICKED_UP]: BOOKING_STATUS.IN_TRANSIT,
  [BOOKING_STATUS.IN_TRANSIT]: BOOKING_STATUS.DELIVERED,
};

module.exports = {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  CHARGE_TYPE,
  OFFER_STATUS,
  HANDLED_BY,
  ACTIVE_BOOKING_STATUSES,
  TERMINAL_BOOKING_STATUSES,
  PAYABLE_STATUSES,
  DRIVER_ALLOWED_TRANSITIONS,
};
