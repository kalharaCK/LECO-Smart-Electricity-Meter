require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDb, closePool } = require('./config/db');
const { initSocket } = require('./services/socketService');
const { setupProcessImmunity, registerGracefulShutdown } = require('./utils/immunitySupervisor');

// Process-level Crash Immunity: Intercepts unhandled rejections, uncaught exceptions, and warnings
setupProcessImmunity();

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Register graceful zero-downtime shutdown on SIGTERM / SIGINT
registerGracefulShutdown(server, { closeDbPool: closePool });

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    if (process.env.NODE_ENV === 'production' && !process.env.ML_SERVICE_TOKEN) {
      throw new Error('ML_SERVICE_TOKEN must be configured when the ML service is enabled in production.');
    }
    await connectDb();
    
    // Initialize optional WebSocket support for live broadcast without blocking REST API
    initSocket(server);

    server.listen(port, () => {
      console.log('====================================================');
      console.log('⚡ LECO Self Care Enterprise REST Server Ready');
      console.log(`📡 Port: ${port}`);
      console.log('🔒 Security: JWT Bearer + Strict Customer/Staff RBAC');
      console.log(`🌐 Customer API: http://localhost:${port}/api/customer`);
      console.log(`🛠️  Staff API:    http://localhost:${port}/api/staff`);
      console.log(`🩺 Health:       http://localhost:${port}/api/health`);
      console.log('🛡️  Immunity:     Process & DB Crash Protection Active');
      console.log('====================================================');
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
};

startServer();
