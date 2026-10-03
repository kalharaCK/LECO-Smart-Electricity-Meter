import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io('http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to LECO Smart Meter WebSocket:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('⚡ Disconnected from LECO WebSocket:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('⚡ WebSocket connection error:', error.message);
    });
  }
  return socket;
};
