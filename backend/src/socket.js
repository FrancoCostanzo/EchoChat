const { Server } = require('socket.io');
const config = require('./config');
const logger = require('./config/logger');
const { registerSocket, unregisterSocket } = require('./config/socketStore');

// NOTE: services & repositories are lazy-loaded inside functions to avoid
// a circular dependency (message.service → socket → services → message.service).

let io;
const offlineTimers = new Map();

function cancelOfflineTimer(userId) {
  const timer = offlineTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    offlineTimers.delete(userId);
  }
}

function scheduleOffline(userId) {
  cancelOfflineTimer(userId);
  const timer = setTimeout(async () => {
    offlineTimers.delete(userId);
    try {
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (sockets.length === 0) {
        await updatePresence(userId, 'offline');
      }
    } catch (err) {
      logger.warn({ err: err.message, userId }, 'Failed to mark user offline');
    }
  }, 2500);
  offlineTimers.set(userId, timer);
}

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
    registerSocket(socket.id, userId);

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

    // ── Restore presence on connect (debounced disconnect avoids F5 → offline) ─
    cancelOfflineTimer(userId);
    try {
      const dbUser = await userRepository.findById(userId);
      if (dbUser?.presence === 'offline') {
        await updatePresence(userId, 'online');
      } else if (dbUser?.presence) {
        await userRepository.updatePresence(userId, dbUser.presence);
        io.emit('presence:changed', { userId, presence: dbUser.presence });
      } else {
        await updatePresence(userId, 'online');
      }
    } catch (err) {
      logger.warn({ err: err.message, userId }, 'Failed to restore presence on connect');
      await updatePresence(userId, 'online');
    }

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

    // ── Mark delivered (cuando un mensaje llega al cliente pero no se lee) ──
    socket.on('messages:delivered', async ({ conversationId, messageIds }) => {
      try {
        require('fs').appendFileSync(
          require('path').join(__dirname, '../delivery-debug.log'),
          `${new Date().toISOString()} DELIVERED-RECV user=${userId} conv=${conversationId} msgs=${JSON.stringify(messageIds)}\n`,
        );
      } catch {}
      logger.info({ userId, conversationId, messageIds }, '[DELIVERY] messages:delivered recibido');
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;
      const { messageRepository } = require('./repositories');
      try {
        for (const msgId of messageIds) {
          await messageRepository.addReceipt(msgId, userId, 'delivered');
        }
        // Avisar al emisor (y al resto de la conversación) para que el tick del
        // chat pase de "enviado" a "entregado" en tiempo real.
        const countsMap = await messageRepository.getReceiptCountsBatch(messageIds);
        let room = conversationId ? `conv:${conversationId}` : null;
        for (const msgId of messageIds) {
          const counts = countsMap[msgId];
          if (!counts) continue;
          if (!room) {
            const message = await messageRepository.findById(msgId);
            if (!message) continue;
            room = `conv:${message.conversation_id}`;
          }
          const sockets = await io.in(room).fetchSockets();
          try {
            require('fs').appendFileSync(
              require('path').join(__dirname, '../delivery-debug.log'),
              `${new Date().toISOString()} EMIT-RECEIPT room=${room} msg=${msgId} delivered=${Number(counts.delivered_count)} socketsEnRoom=${sockets.length} userIds=${JSON.stringify(sockets.map((s) => s.userId))}\n`,
            );
          } catch {}
          io.to(room).emit('message:receipt', {
            messageId: msgId,
            delivered_count: Number(counts.delivered_count) || 0,
            read_count: Number(counts.read_count) || 0,
          });
        }
      } catch (err) {
        logger.warn({ err: err.message, userId }, 'Failed to process delivery receipts');
      }
    });

    // ── Disconnect ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');
      unregisterSocket(socket.id);
      // Grace period so F5 / tab refresh does not flash offline in DB or /me
      scheduleOffline(userId);
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
