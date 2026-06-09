const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] } // Adjust port if Vite uses 5173
});

// Simulate LECO Meter Data
setInterval(() => {
  const data = {
    time: new Date().toLocaleTimeString(),
    power: (Math.random() * (5 - 0.5) + 0.5).toFixed(2), // kW
    voltage: (Math.random() * (240 - 220) + 220).toFixed(1), // Volts
    current: (Math.random() * (20 - 1) + 1).toFixed(2), // Amps
  };
  io.emit('meterData', data);
}, 2000); // Sends data every 2 seconds

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));