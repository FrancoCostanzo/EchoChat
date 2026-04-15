const { Server } = require('socket.io');
const config = require('./config');
const logger = require('./config/logger');

// NOTE: services & repositories are lazy-loaded inside functions to avoid
// a circular dependency (message.service → socket → services → message.service).

let io;

function initSocket(httpServer) {
  const { authService } = require('./services');
  const { conversationRepository, userRepository } = require('./repositories');

  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
  });

  // ── Auth middleware ──────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const { user } = await authService.validateToken(token);
      socket.userId = user.id;
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    logger.info({ userId, socketId: socket.id }, 'Socket connected');

    // Join a personal room for direct events
    socket.join(`user:${userId}`);

    // Join all conversation rooms this user belongs to
    try {
      const conversations = await conversationRepository.findUserConversations(userId);
      for (const conv of conversations) {
        socket.join(`conv:${conv.id}`);
      }
    } catch (err) {
      logger.warn({ err: err.message, userId }, 'Failed to join conversation rooms');
    }

    // ── Update presence to online ───────────────────────────────────
    await updatePresence(userId, 'online');

    // ── Join a new conversation room (when creating/entering one) ───
    socket.on('join:conversation', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    // ── Typing indicators ───────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId,
        displayName: socket.user.display_name,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId,
      });
    });

    // ── Read receipts ───────────────────────────────────────────────
    socket.on('messages:read', async ({ conversationId, messageIds }) => {
      if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) return;
      const { messageRepository, conversationRepository } = require('./repositories');
      try {
        for (const msgId of messageIds) {
          await messageRepository.addReceipt(msgId, userId, 'read');
        }
        // Update last_read_at so unread_count recalculates correctly
        const lastMsgId = messageIds[messageIds.length - 1];
        await conversationRepository.markAsRead(conversationId, userId, lastMsgId);
        // Get actual counts from DB for all affected messages
        const countsMap = await messageRepository.getReceiptCountsBatch(messageIds);
        socket.to(`conv:${conversationId}`).emit('messages:read', {
          conversationId,
          userId,
          countsMap,
        });
      } catch (err) {
        logger.warn({ err: err.message, userId }, 'Failed to process read receipts');
      }
    });

    // ── Mark delivered on connection (for messages received while offline) ─
    socket.on('messages:delivered', async ({ messageIds }) => {
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;
      const { messageRepository } = require('./repositories');
      try {
        for (const msgId of messageIds) {
          await messageRepository.addReceipt(msgId, userId, 'delivered');
        }
      } catch (err) {
        logger.warn({ err: err.message, userId }, 'Failed to process delivery receipts');
      }
    });

    // ── Disconnect ──────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');

      // Check if user has any other active sockets
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (sockets.length === 0) {
        await updatePresence(userId, 'offline');
      }
    });
  });

  return io;
}

async function updatePresence(userId, presence) {
  const { userRepository } = require('./repositories');
  try {
    await userRepository.updatePresence(userId, presence);
    // Broadcast presence change to all users who share a conversation
    io.emit('presence:changed', { userId, presence });
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'Failed to update presence');
  }
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

module.exports = { initSocket, getIO };
