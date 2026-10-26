const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { extractSessionToken, meterRoomAccessQuery } = require('./socketSecurity');

let io = null;

/**
 * Initialize Socket.io server with CORS support
 * @param {import('http').Server} server 
 */
const initSocket = (server) => {
  const production = process.env.NODE_ENV === 'production';
  const origins = production
    ? [process.env.FRONTEND_URL, process.env.STAFF_FRONTEND_URL].filter(Boolean)
    : [process.env.FRONTEND_URL || 'http://localhost:5173', process.env.STAFF_FRONTEND_URL || 'http://localhost:5174',
        'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];
  io = new Server(server, {
    cors: {
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = extractSessionToken(socket.handshake.headers.cookie || '');
      if (!token) return next(new Error('Authentication required'));

      const claims = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [claims.id]);
      if (!result.rows.length) return next(new Error('Authentication required'));

      const role = String(result.rows[0].role || '').toLowerCase();
      if (!['customer', 'user', 'staff', 'admin'].includes(role)) {
        return next(new Error('Authentication required'));
      }
      socket.data.user = { id: result.rows[0].id, role };
      return next();
    } catch (error) {
      return next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, role } = socket.data.user;
    const isStaff = role === 'staff' || role === 'admin';
    socket.join(`user_${userId}`);
    if (isStaff) {
      socket.join('staff_room');
      socket.join('all_meters');
    }

    socket.on('join_meter', async (meterId) => {
      const id = Number(meterId);
      if (!Number.isSafeInteger(id) || id <= 0) return;
      try {
        const accessQuery = meterRoomAccessQuery(role, id, userId);
        if (!accessQuery) return;
        const result = await pool.query(...accessQuery);
        if (result.rows.length) socket.join(`meter_${id}`);
      } catch (error) {
        console.error('[Socket] Failed to authorize meter room:', error.message);
      }
    });

    socket.on('leave_meter', (meterId) => {
      const id = Number(meterId);
      if (Number.isSafeInteger(id) && id > 0) socket.leave(`meter_${id}`);
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
        io.to('all_meters').emit('meter_update', { meterId, ...payload });
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
