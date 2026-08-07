import type { Server } from 'socket.io';

/**
 * Registro de conexiones Socket.IO para las métricas de monitoreo.
 *
 * Los Map locales sólo ven los sockets de este proceso, así que con varias
 * instancias el panel mostraría los de una sola. `getSocketMetrics()` consulta
 * al adapter (todo el cluster) y usa los Map como respaldo cuando Socket.IO
 * todavía no está inicializado — por ejemplo al correr los jobs desde la CLI.
 */

export const connectedSockets = new Map<string, string>(); // socketId → userId
export const connectedUsers = new Map<string, Set<string>>(); // userId → Set<socketId>

// socket.js nos pasa el servidor al inicializar. Antes lo buscábamos con un
// require perezoso de '../socket', que cerraba un ciclo (socket → socketStore
// → socket).
let servidor: Server | null = null;

export function setSocketServer(io: Server | null): void {
  servidor = io;
}

export function registerSocket(socketId: string, userId: string): void {
  connectedSockets.set(socketId, userId);
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId)!.add(socketId);
}

export function unregisterSocket(socketId: string): void {
  const userId = connectedSockets.get(socketId);
  if (userId == null) return;

  connectedSockets.delete(socketId);
  const sockets = connectedUsers.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      connectedUsers.delete(userId);
    }
  }
}

export interface SocketMetrics {
  activeSockets: number;
  uniqueUsers: number;
}

function getLocalMetrics(): SocketMetrics {
  return {
    activeSockets: connectedSockets.size,
    uniqueUsers: connectedUsers.size,
  };
}

/**
 * Métricas de todo el cluster. fetchSockets() serializa cada socket de cada
 * instancia: es aceptable en un endpoint de monitoreo, no en un hot path.
 */
export async function getSocketMetrics(): Promise<SocketMetrics> {
  if (!servidor) return getLocalMetrics();
  try {
    const sockets = await servidor.fetchSockets();
    const users = new Set<string>();
    for (const socket of sockets) {
      if (socket.data?.userId) users.add(socket.data.userId);
    }
    return {
      activeSockets: sockets.length,
      uniqueUsers: users.size,
    };
  } catch {
    // Socket.IO sin inicializar (o adapter no disponible): sólo este proceso.
    return getLocalMetrics();
  }
}
