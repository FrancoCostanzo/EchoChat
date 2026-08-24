import { io, Socket } from 'socket.io-client';
import { getServerUrl } from './runtimeConfig';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  // '/' (web) resuelve contra el origin actual; en Electron hace falta la URL
  // absoluta del servidor configurado. Ver lib/runtimeConfig.ts.
  socket = io(getServerUrl() || '/', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    if (import.meta.env.DEV) console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    if (import.meta.env.DEV) console.log('[Socket] Disconnected:', reason);
  });

  // Este sí queda en producción: no expone datos y es lo primero que se mira
  // cuando alguien reporta "no me llegan los mensajes".
  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
