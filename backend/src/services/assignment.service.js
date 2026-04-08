// src/services/assignment.service.js
//
// Assignment Engine (Manual / Semi / Full Auto)
// Implements driver scoring based on PRD rules:
// - Proximity (within assignment_radius_km when coords are available)
// - Availability flags (is_available, can_receive_assignments)
// - Compliance: user.compliance_status === 'approved', not deleted/inactive
// - Blacklist guard
// - Vehicle match (vehicle_type), verified & not blocked
// - Rating threshold (min_driver_rating)
//
// Exports:
//   suggestDriversForBooking(booking, limit)
//   autoAssignIfNeeded(booking, auditLog?)

const { Op } = require('sequelize');
const {
  Driver,
  Vehicle,
  User,
  SystemSetting,
  Booking,
  CustomerDriverRule,
} = require('../models');
const { haversineDistance } = require('../utils/helpers');

/* -------------------------------------------------------------------------- */
/* CONFIG HELPERS                                                             */
/* -------------------------------------------------------------------------- */

const DEFAULT_CONFIG = {
  mode: 'manual',            // manual | semi_auto | full_auto
  radiusKm: 10,
  minRating: 3.5,
};

const loadAssignmentConfig = async () => {
  // Settings are stored two ways in SystemSetting:
  //  - key/value rows (setAssignmentMode uses key='assignment_mode')
  //  - direct columns (legacy)
  const row = await SystemSetting.findOne({
    where: { key: 'assignment_mode' },
  });

  const mode = row?.value || row?.assignment_mode || DEFAULT_CONFIG.mode;

  const radiusRow = await SystemSetting.findOne({ where: { key: 'assignment_radius_km' } });
  const minRatingRow = await SystemSetting.findOne({ where: { key: 'min_driver_rating' } });

  return {
    mode,
    radiusKm: Number(radiusRow?.value || row?.assignment_radius_km || DEFAULT_CONFIG.radiusKm),
    minRating: Number(minRatingRow?.value || row?.min_driver_rating || DEFAULT_CONFIG.minRating),
  };
};

/* -------------------------------------------------------------------------- */
/* DRIVER DISCOVERY + SCORING                                                 */
/* -------------------------------------------------------------------------- */

const fetchCustomerRules = async (customerId) => {
  if (!customerId) return { whitelist: new Set(), blacklist: new Set() };
  const rows = await CustomerDriverRule.findAll({
    where: { customer_id: customerId },
    attributes: ['driver_id', 'rule_type'],
  });
  const whitelist = new Set(rows.filter(r => r.rule_type === 'whitelist').map(r => r.driver_id));
  const blacklist = new Set(rows.filter(r => r.rule_type === 'blacklist').map(r => r.driver_id));
  return { whitelist, blacklist };
};

const fetchEligibleDrivers = async (booking) => {
  const whereDriver = {
    is_available: true,
    can_receive_assignments: true,
    is_blacklisted: false,
  };

  // Only approved, active, non-deleted users
  const userWhere = {
    compliance_status: 'approved',
    is_active: true,
    is_deleted: false,
  };

  const include = [
    {
      model: User,
      as: 'user',
      where: userWhere,
      required: true,
      attributes: ['id', 'full_name', 'role', 'email', 'phone'],
    },
    {
      model: Vehicle,
      as: 'current_vehicle',
      required: false,
      where: {
        is_verified: true,
        is_assignment_blocked: false,
        is_active: true,
      },
    },
  ];

  return Driver.findAll({
    where: whereDriver,
    include,
    order: [['updated_at', 'DESC']],
  });
};

const matchesLocationInterest = (driver, booking) => {
  if (!driver.location_interest || !booking.pickup_lat || !booking.pickup_lng) return false;
  const { lat, lng, radius_km } = driver.location_interest;
  if (lat === undefined || lng === undefined) return false;
  const radius = Number(radius_km || 25);
  const dist = haversineDistance(
    Number(lat), Number(lng),
    Number(booking.pickup_lat), Number(booking.pickup_lng)
  );
  return dist <= radius;
};

const scoreDriver = (driver, booking, config, rules) => {
  const vehicle = driver.current_vehicle;

  if (rules?.blacklist?.has(driver.id)) {
    return null;
  }

  // Vehicle match: if booking demands a type, require it
  if (booking.vehicle_type && vehicle && vehicle.vehicle_type !== booking.vehicle_type) {
    return null;
  }

  // Rating threshold
  if (driver.avg_rating && Number(driver.avg_rating) < config.minRating) {
    return null;
  }

  // Proximity
  let distanceKm = null;
  if (
    booking.pickup_lat && booking.pickup_lng &&
    driver.current_lat && driver.current_lng
  ) {
    distanceKm = haversineDistance(
      Number(booking.pickup_lat),
      Number(booking.pickup_lng),
      Number(driver.current_lat),
      Number(driver.current_lng),
    );

    // If we have a radius, enforce it
    if (config.radiusKm && distanceKm > config.radiusKm) {
      return null;
    }
  }

  const interestMatch = matchesLocationInterest(driver, booking);

  // Simple scoring: whitelist/interest boost, closer distance first, then higher rating, then recent activity
  const score = [
    rules?.whitelist?.has(driver.id) ? -1000 : 0,      // huge boost if whitelisted
    interestMatch ? -100 : 0,                          // boost if driver requested this area
    distanceKm !== null ? distanceKm : 9999,          // lower is better
    -(Number(driver.avg_rating) || 0),                // higher rating better (negated)
    -(driver.updated_at ? new Date(driver.updated_at).getTime() : 0), // more recent better
  ];

  return {
    driverId: driver.id,
    vehicleId: vehicle?.id || null,
    distanceKm,
    avgRating: Number(driver.avg_rating) || 0,
    score,
  };
};

const rankDrivers = (drivers, booking, config, rules, limit = 5) => {
  const scored = [];
  for (const d of drivers) {
    const s = scoreDriver(d, booking, config, rules);
    if (s) scored.push(s);
  }

  scored.sort((a, b) => {
    // Lexicographic compare on score tuple
    for (let i = 0; i < a.score.length; i++) {
      if (a.score[i] < b.score[i]) return -1;
      if (a.score[i] > b.score[i]) return 1;
    }
    return 0;
  });

  return scored.slice(0, limit);
};

/* -------------------------------------------------------------------------- */
/* PUBLIC API                                                                 */
/* -------------------------------------------------------------------------- */

const suggestDriversForBooking = async (booking, limit = 5) => {
  const config = await loadAssignmentConfig();
  const drivers = await fetchEligibleDrivers(booking);
  const rules = await fetchCustomerRules(booking.customer_id);
  const ranked = rankDrivers(drivers, booking, config, rules, limit);
  return { config, ranked };
};

const autoAssignIfNeeded = async (booking, auditLog) => {
  if (!booking || !(booking instanceof Booking)) {
    throw new Error('autoAssignIfNeeded requires a Booking instance');
  }

  const config = await loadAssignmentConfig();
  if (config.mode !== 'full_auto') {
    return { mode: config.mode, assigned: false, reason: 'MODE_NOT_FULL_AUTO' };
  }

  const { ranked } = await suggestDriversForBooking(booking, 1);
  const best = ranked[0];

  if (!best) {
    return { mode: config.mode, assigned: false, reason: 'NO_ELIGIBLE_DRIVERS' };
  }

  await booking.update({
    assigned_driver_id: best.driverId,
    vehicle_id: best.vehicleId || booking.vehicle_id,
    status: 'assigned',
    assigned_at: new Date(),
  });

  if (auditLog) {
    await auditLog('BOOKING_AUTO_ASSIGNED', {
      booking_id: booking.id,
      driver_id: best.driverId,
      vehicle_id: best.vehicleId,
      mode: config.mode,
    });
  }

  return {
    mode: config.mode,
    assigned: true,
    driver_id: best.driverId,
    vehicle_id: best.vehicleId,
  };
};

module.exports = {
  suggestDriversForBooking,
  autoAssignIfNeeded,
};
