// src/config/socket.js

const { verifyJwt } = require('../utils/jwt');

module.exports = (io) => {

  // ================= AUTH MIDDLEWARE =================
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      console.error('❌ Socket auth failed: Missing token');
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = verifyJwt(token);

      socket.data.user = decoded;

      next();
    } catch (err) {
      console.error('❌ Socket auth failed: Invalid token');
      next(new Error('Authentication error'));
    }
  });

  // ================= CONNECTION =================
  io.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    const userRole = socket.data.user?.role;

    console.log(`✅ Connected: ${userId} (${userRole}) | ${socket.id}`);

    // ================= USER ROOM =================
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // ================= ROLE ROOMS =================
    switch (userRole) {

      case 'driver':
        socket.join('drivers');
        socket.join(`driver:${userId}`);
        break;

      case 'customer':
        socket.join('customers');
        socket.join(`customer:${userId}`);
        break;

      case 'transporter':
        socket.join('transporters');
        socket.join(`transporter:${userId}`);
        break;

      case 'agent':
        socket.join('agents');
        socket.join(`agent:${userId}`);
        break;

      case 'agency':
        socket.join('agencies');
        socket.join(`agency:${userId}`);
        break;

      case 'admin':
      case 'operations_admin':
      case 'finance_admin':
        socket.join('admins');
        socket.join('global:admin');
        break;

      case 'super_admin':
        socket.join('super_admins');
        socket.join('global:super_admin');
        break;

      default:
        console.warn(`⚠️ Unknown role: ${userRole}`);
    }

    // ================= EVENTS (FUTURE READY) =================

    // Driver location update (future use)
    socket.on('driver:location:update', (data) => {
      socket.to('admins').emit('driver:location:update', {
        driverId: userId,
        ...data
      });
    });

    // Booking updates (future)
    socket.on('booking:update', (data) => {
      io.to('admins').emit('booking:update', data);
    });

    // ================= HEARTBEAT =================
    socket.on('ping', (callback) => {
      if (callback) callback();
    });

    // ================= DISCONNECT =================
    socket.on('disconnect', () => {
      console.log(`❌ Disconnected: ${userId} | ${socket.id}`);
    });

  });
};
