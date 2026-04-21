// server.js
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const prisma = require('./src/utils/prisma');

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected via Prisma');

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
