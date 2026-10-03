require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDb } = require('./config/db');
const { initSocket } = require('./services/socketService');

const port = process.env.PORT || 3000;
const server = http.createServer(app);

const startServer = async () => {
  await connectDb();
  initSocket(server);
  server.listen(port, () => {
    console.log(`Server listening on port ${port} with WebSockets enabled`);
  });
};

startServer();
