import { API_BASE_URL } from "@/lib/api"
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to LECO Smart Meter WebSocket:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from LECO WebSocket:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket] WebSocket connection error:', error.message);
    });
  }
  return socket;
};
