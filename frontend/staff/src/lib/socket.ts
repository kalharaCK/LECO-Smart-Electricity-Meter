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
      console.log('⚡ Staff portal connected to LECO Grid WebSocket:', socket?.id);
      socket?.emit('join_staff');
    });

    socket.on('disconnect', (reason) => {
      console.log('⚡ Staff portal disconnected from WebSocket:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('⚡ Staff portal WebSocket connection error:', error.message);
    });
  }
  return socket;
};
