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

const prisma = require('../utils/prisma');
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
  const row = await prisma.systemSetting.findUnique({ where: { key: 'assignment_mode' } });

  const mode = row?.value || row?.assignment_mode || DEFAULT_CONFIG.mode;

  const radiusRow = await prisma.systemSetting.findUnique({ where: { key: 'assignment_radius_km' } });
  const minRatingRow = await prisma.systemSetting.findUnique({ where: { key: 'min_driver_rating' } });

  return {
    mode,
    radiusKm: Number(radiusRow?.value || DEFAULT_CONFIG.radiusKm),
    minRating: Number(minRatingRow?.value || row?.min_driver_rating || DEFAULT_CONFIG.minRating),
  };
};

/* -------------------------------------------------------------------------- */
/* DRIVER DISCOVERY + SCORING                                                 */
/* -------------------------------------------------------------------------- */

const fetchCustomerRules = async (customerId) => {
  if (!customerId) return { whitelist: new Set(), blacklist: new Set() };
  const rows = await prisma.customerDriverRule.findMany({
    where: { customerId },
    select: { driverId: true, ruleType: true },
  });
  const whitelist = new Set(rows.filter(r => r.ruleType === 'whitelist').map(r => r.driverId));
  const blacklist = new Set(rows.filter(r => r.ruleType === 'blacklist').map(r => r.driverId));
  return { whitelist, blacklist };
};

const fetchEligibleDrivers = async (booking) => {
  return prisma.driver.findMany({
    where: {
      isAvailable: true,
      canReceiveAssignments: true,
      isBlacklisted: false,
      user: {
        complianceStatus: 'approved',
        isActive: true,
        deletedAt: null
      }
    },
    include: {
      user: {
        select: { id: true, full_name: true, role: true, email: true, phone: true }
      },
      currentVehicle: {
        where: {
          isVerified: true,
          isAssignmentBlocked: false,
          isActive: true
        }
      }
    }
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
  const vehicle = driver.currentVehicle;

  if (rules?.blacklist?.has(driver.id)) {
    return null;
  }

  // Vehicle match: if booking demands a type, require it
  if (booking.vehicleType && vehicle && vehicle.vehicleType !== booking.vehicleType) {
    return null;
  }

  // Rating threshold
  if (driver.avgRating && Number(driver.avgRating) < config.minRating) {
    return null;
  }

  // Proximity
  let distanceKm = null;
  if (
    booking.pickup_lat && booking.pickup_lng &&
    driver.currentLat && driver.currentLng
  ) {
    distanceKm = haversineDistance(
      Number(booking.pickup_lat),
      Number(booking.pickup_lng),
      Number(driver.currentLat),
      Number(driver.currentLng),
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
    -(Number(driver.avgRating) || 0),                // higher rating better (negated)
    -(driver.updatedAt ? new Date(driver.updatedAt).getTime() : 0), // more recent better
  ];

  return {
    driverId: driver.id,
    vehicleId: vehicle?.id || null,
    distanceKm,
    avgRating: Number(driver.avgRating) || 0,
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
  return { config, ranked: ranked.map(r => ({ ...r, driver: drivers.find(d => d.id === r.driverId) })) };
};

const autoAssignIfNeeded = async (booking, auditLog) => {
  const config = await loadAssignmentConfig();
  if (config.mode !== 'full_auto') {
    return { mode: config.mode, assigned: false, reason: 'MODE_NOT_FULL_AUTO' };
  }

  const { ranked } = await suggestDriversForBooking(booking, 1);
  const best = ranked[0];

  if (!best) {
    return { mode: config.mode, assigned: false, reason: 'NO_ELIGIBLE_DRIVERS' };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      assignedDriverId: best.driverId,
      vehicleId: best.vehicleId || booking.vehicleId,
      status: 'assigned',
      assignedAt: new Date(),
    }
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
