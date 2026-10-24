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

    socket.on('join_staff', () => {
      socket.join('staff_room');
    });
  });

  return io;
};

const getIo = () => io;

/**
 * Broadcast real-time meter telemetry & balance update to listening room
 * Fully decoupled and asynchronous - will never block or throw in REST context.
 * @param {number|string} meterId 
 * @param {object} payload 
 */
const emitMeterUpdate = (meterId, payload) => {
  setImmediate(() => {
    try {
      if (io && meterId) {
        io.to(`meter_${meterId}`).emit('meter_update', payload);
        io.emit('meter_update', { meterId, ...payload });
      }
    } catch (err) {
      console.warn('[SocketService] Non-critical socket emitMeterUpdate error:', err.message);
    }
  });
};

/**
 * Broadcast real-time notification to user's room
 * Fully decoupled and asynchronous - will never block or throw in REST context.
 * @param {number|string} userId 
 * @param {object} notification 
 */
const emitNotification = (userId, notification) => {
  setImmediate(() => {
    try {
      if (io && userId) {
        io.to(`user_${userId}`).emit('notification', notification);
        io.emit('notification', { userId, ...notification });
      }
    } catch (err) {
      console.warn('[SocketService] Non-critical socket emitNotification error:', err.message);
    }
  });
};

/**
 * Broadcast real-time complaint status update to user's room and staff
 * Fully decoupled and asynchronous - will never block or throw in REST context.
 * @param {number|string} userId 
 * @param {object} complaint 
 */
const emitComplaintUpdate = (userId, complaint) => {
  setImmediate(() => {
    try {
      if (io) {
        if (userId) {
          io.to(`user_${userId}`).emit('complaint_update', complaint);
        }
        io.to('staff_room').emit('complaint_update', complaint);
        io.emit('complaint_update', complaint);
      }
    } catch (err) {
      console.warn('[SocketService] Non-critical socket emitComplaintUpdate error:', err.message);
    }
  });
};

module.exports = {
  initSocket,
  getIo,
  emitMeterUpdate,
  emitNotification,
  emitComplaintUpdate
};
