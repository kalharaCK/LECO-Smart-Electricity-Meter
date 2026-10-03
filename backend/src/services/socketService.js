const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.io server with CORS support
 * @param {import('http').Server} server 
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174'
      ],
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_meter', (meterId) => {
      if (meterId) {
        socket.join(`meter_${meterId}`);
      }
    });

    socket.on('leave_meter', (meterId) => {
      if (meterId) {
        socket.leave(`meter_${meterId}`);
      }
    });

    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });
  });

  return io;
};

const getIo = () => io;

/**
 * Broadcast real-time meter telemetry & balance update to listening room
 * @param {number|string} meterId 
 * @param {object} payload 
 */
const emitMeterUpdate = (meterId, payload) => {
  if (io && meterId) {
    io.to(`meter_${meterId}`).emit('meter_update', payload);
  }
};

/**
 * Broadcast real-time notification to user's room
 * @param {number|string} userId 
 * @param {object} notification 
 */
const emitNotification = (userId, notification) => {
  if (io && userId) {
    io.to(`user_${userId}`).emit('notification', notification);
  }
};

/**
 * Broadcast real-time complaint status update to user's room
 * @param {number|string} userId 
 * @param {object} complaint 
 */
const emitComplaintUpdate = (userId, complaint) => {
  if (io && userId) {
    io.to(`user_${userId}`).emit('complaint_update', complaint);
  }
};

module.exports = {
  initSocket,
  getIo,
  emitMeterUpdate,
  emitNotification,
  emitComplaintUpdate
};
