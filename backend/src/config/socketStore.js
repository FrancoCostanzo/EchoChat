/** In-memory registry of active Socket.IO connections for monitoring metrics. */

const connectedSockets = new Map(); // socketId → userId
const connectedUsers = new Map(); // userId → Set<socketId>

function registerSocket(socketId, userId) {
  connectedSockets.set(socketId, userId);
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socketId);
}

function unregisterSocket(socketId) {
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

function getSocketMetrics() {
  return {
    activeSockets: connectedSockets.size,
    uniqueUsers: connectedUsers.size,
  };
}

module.exports = {
  connectedSockets,
  connectedUsers,
  registerSocket,
  unregisterSocket,
  getSocketMetrics,
};
