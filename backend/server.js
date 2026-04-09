// server.js
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

// ✅ 1. Load DB first
const { connectDB, sequelize } = require('./src/config/database');

// ✅ 2. Load models BEFORE app (VERY IMPORTANT)
require('./src/models');

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Clean legacy OTP rows that miss user linkage (prevents NOT NULL constraint errors)
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Dev: safest reset to keep PRD constraint intact
        await sequelize.query('TRUNCATE TABLE "login_otps" CASCADE;');
        console.log('🧹 Truncated login_otps (dev) to clear NULL user_id rows');
      } else {
        // Prod: fail fast to avoid silent data loss
        const [remaining] = await sequelize.query('SELECT COUNT(*) FROM "login_otps" WHERE "user_id" IS NULL;');
        const remainingCount = Number(remaining?.[0]?.count || 0);
        if (remainingCount > 0) {
          throw new Error(`login_otps has ${remainingCount} NULL user_id rows; clean DB before boot.`);
        }
      }
    } catch (cleanupErr) {
      console.warn('⚠️ Could not clean null login_otps rows:', cleanupErr.message);
    }

    // ✅ alter:true — safely updates tables without dropping data
    await sequelize.sync({ alter: true });

    console.log('✅ Database tables synced');

    // ✅ Create HTTP server for Socket.io
    const server = http.createServer(app);

    // ✅ Initialize Socket.io with CORS
    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true
      }
    });

    // ✅ Initialize Socket config (middleware + rooms)
    require('./src/config/socket')(io);

    // ✅ Initialize Booking Socket handlers (broadcast functions)
    require('./src/sockets/bookingSocket')(io);

    // ✅ Attach io to app for use in routes
    app.set('io', io);

    server.listen(PORT, () => {
      console.log('🚀 Server running on port', PORT);
      console.log('📡 Socket.io ready for WebSocket connections');
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
