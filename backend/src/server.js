require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDb } = require('./config/db');
const { initSocket } = require('./services/socketService');

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Process-level safety: Prevent uncaught crashes from killing the entire server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection at Promise]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    await connectDb();
    
    // Initialize optional WebSocket support for live broadcast without blocking REST API
    initSocket(server);

    server.listen(port, () => {
      console.log('====================================================');
      console.log(`⚡ LECO Self Care Enterprise REST Server Ready`);
      console.log(`📡 Port: ${port}`);
      console.log(`🔒 Security: JWT Bearer + Strict Customer/Staff RBAC`);
      console.log(`🌐 Customer API: http://localhost:${port}/api/customer`);
      console.log(`🛠️  Staff API:    http://localhost:${port}/api/staff`);
      console.log(`🩺 Health:       http://localhost:${port}/api/health`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
};

startServer();
