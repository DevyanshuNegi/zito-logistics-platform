// src/utils/helpers.js
//
// Shared utility functions used across controllers and services.
// No external dependencies beyond Node.js built-ins and crypto.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

/* ============================================================
   BOOKING REFERENCE GENERATOR
   Generates a human-readable booking reference.
   Format: ZT-YYYYMMDD-XXXXXX  (e.g. ZT-20260415-A3F9K2)
   PRD §8 — bookings.reference field
   ============================================================ */

const generateBookingRef = () => {
  const date    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix  = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ZT-${date}-${suffix}`;
};

/* ============================================================
   OTP GENERATOR
   Cryptographically secure 6-digit OTP.
   PRD §11 — 2FA OTP for every login.
   ============================================================ */

const generateOtp = () => {
  // Range: 100000–999999 (always 6 digits)
  const otp = crypto.randomInt(100000, 999999);
  return String(otp);
};

/* ============================================================
   OTP EXPIRY
   Returns a Date object N minutes from now.
   Default: 10 minutes (standard OTP window).
   ============================================================ */

const otpExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

/* ============================================================
   IS OTP EXPIRED
   ============================================================ */

const isOtpExpired = (expiresAt) => {
  return new Date() > new Date(expiresAt);
};

/* ============================================================
   PAGINATION PARAMS
   Extracts and sanitises page + limit from req.query.
   Always returns integers within safe bounds.
   PRD §25 — default page size 20, max 100.
   ============================================================ */

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page, 10)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const paginate = getPagination;

const paginatedResponse = (rows, count, page, limit) => {
  const totalPages = Math.ceil(count / limit);
  return {
    data: rows,
    meta: {
      total:        count,
      page:         Number(page),
      limit:        Number(limit),
      total_pages:  totalPages,
      has_next:     page < totalPages,
      has_prev:     page > 1,
    }
  };
};

/* ============================================================
   SEQUELIZE PAGINATION OPTIONS
   Merges pagination into a Sequelize findAndCountAll options object.

   Usage:
     const { page, limit, offset } = getPagination(req.query);
     const result = await Booking.findAndCountAll({
       where,
       ...paginateQuery(limit, offset),
     });
   ============================================================ */

const paginateQuery = (limit, offset) => ({ limit, offset });

/* ============================================================
   SAFE PICK
   Returns a new object containing only the specified keys.
   Use to strip sensitive fields before sending responses.

   Usage:
     const safe = pick(user, ['id', 'full_name', 'email', 'role']);
   ============================================================ */

const pick = (obj, keys) => {
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

/* ============================================================
   OMIT
   Returns a new object with specified keys removed.

   Usage:
     const safe = omit(user.toJSON(), ['password', 'otp']);
   ============================================================ */

const omit = (obj, keys) => {
  const result = { ...obj };
  keys.forEach(k => delete result[k]);
  return result;
};

/* ============================================================
   ROUND MONEY
   Rounds a number to 2 decimal places for KES amounts.
   Prevents floating-point drift in financial calculations.
   PRD §7 — all pricing in KES.
   ============================================================ */

const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

/* ============================================================
   CALCULATE TRIP PROFIT
   PRD §7.4 — Profit = Customer Rate - Hire Rate - Trip Expenses
   ============================================================ */

const calculateProfit = (customerRate, hireRate, totalExpenses = 0) => {
  return roundMoney(
    Number(customerRate) - Number(hireRate) - Number(totalExpenses)
  );
};

/* ============================================================
   IS WITHIN RATING WINDOW
   PRD §5.3 — Customer can rate a trip within 48 hours of completion.
   ============================================================ */

const isWithinRatingWindow = (completedAt, hoursWindow = 48) => {
  const cutoff = new Date(completedAt).getTime() + hoursWindow * 60 * 60 * 1000;
  return Date.now() <= cutoff;
};

/* ============================================================
   HAVERSINE DISTANCE
   Returns distance in kilometres between two lat/lng points.
   Used by the Assignment Engine for proximity filtering.
   PRD §4.1 — Proximity rule.
   ============================================================ */

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R    = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return roundMoney(R * c); // km, 2 decimal places
};

const toRad = (deg) => deg * (Math.PI / 180);

/* ============================================================
   IS NIGHT SURCHARGE ACTIVE
   PRD §7.13 — Night Surcharge: trips between 22:00 and 06:00
   ============================================================ */

const isNightSurcharge = (date = new Date()) => {
  const hour = new Date(date).getHours();
  return hour >= 22 || hour < 6;
};

/* ============================================================
   MASK EMAIL
   Returns a masked version of an email for safe display.
   e.g.  vishal@gmail.com → v****l@gmail.com
   ============================================================ */

const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const masked = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
};

/* ============================================================
   MASK PHONE
   Returns a masked Kenyan phone for safe display.
   e.g. +254712345678 → +254***5678
   ============================================================ */

const maskPhone = (phone) => {
  const str = String(phone);
  return str.slice(0, 4) + '*'.repeat(str.length - 8) + str.slice(-4);
};

/* ============================================================
   SLEEP (for testing / retry loops only — never in production flows)
   ============================================================ */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  generateBookingRef,
  generateOtp,
  otpExpiry,
  isOtpExpired,
  paginate,
  paginatedResponse,
  getPagination,
  paginateQuery,
  pick,
  omit,
  roundMoney,
  calculateProfit,
  isWithinRatingWindow,
  haversineDistance,
  isNightSurcharge,
  maskEmail,
  maskPhone,
  sleep,
};