// src/services/broadcast.service.js
// Marketplace broadcast to interested drivers (location interest + backhaul) via socket.io if available; fallback logs.

const prisma = require('../utils/prisma');
const getIO = () => {
  try {
    const app = require('../app');
    return app.get('io') || (app.get('getIO') && app.get('getIO')());
  } catch {
    return null;
  }
};

const findInterestedDrivers = async (booking) => {
  const drivers = await prisma.driver.findMany({
    where: {
      isAvailable: true,
      canReceiveAssignments: true,
      isBlacklisted: false,
    },
    include: {
      currentVehicle: true,
      user: {
        select: { id: true, email: true, phone: true }
      }
    }
  });

  const interested = [];
  for (const d of drivers) {
    // Vehicle type match if booking specifies one
    if (booking.vehicle_type && d.current_vehicle && d.current_vehicle.vehicle_type !== booking.vehicle_type) {
      continue;
    }
    // Location interest check
    if (d.location_interest && booking.pickup_lat && booking.pickup_lng) {
      const { haversineDistance } = require('../utils/helpers');
      const dist = haversineDistance(
        Number(d.location_interest.lat),
        Number(d.location_interest.lng),
        Number(booking.pickup_lat),
        Number(booking.pickup_lng)
      );
      if (dist <= Number(d.location_interest.radius_km || 25)) {
        interested.push(d);
        continue;
      }
    }
    // Backhaul check: if driver wants backhaul and is near delivery area of previous trip
    if (d.wants_backhaul && d.last_drop_lat && d.last_drop_lng && booking.pickup_lat && booking.pickup_lng) {
      const { haversineDistance } = require('../utils/helpers');
      const dist = haversineDistance(
        Number(d.last_drop_lat),
        Number(d.last_drop_lng),
        Number(booking.pickup_lat),
        Number(booking.pickup_lng)
      );
      if (dist <= 50) { // 50km radius for backhaul
        interested.push(d);
      }
    }
  }
  return interested;
};

const broadcastNewLoad = async (booking) => {
  const drivers = await findInterestedDrivers(booking);
  const payload = {
    booking_id: booking.id,
    reference: booking.reference,
    pickup: booking.pickup_address,
    delivery: booking.delivery_address,
    vehicle_type: booking.vehicle_type,
    customer_rate: booking.customer_rate,
    created_at: booking.created_at,
  };

  // Socket broadcast
  const io = getIO();
  if (io) {
    drivers.forEach(d => {
      io.to(`driver:${d.id}`).emit('load:new', payload);
    });
  } else {
    console.log(`[BROADCAST] load ${booking.reference} -> ${drivers.length} interested drivers`);
  }

  return { count: drivers.length };
};

module.exports = {
  broadcastNewLoad,
};
