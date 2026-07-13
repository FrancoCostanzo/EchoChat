const { Server } = require('socket.io');
const config = require('./config');
const logger = require('./config/logger');
const { registerSocket, unregisterSocket } = require('./config/socketStore');
const { autoAwayUsers } = require('./config/presenceStore');

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

    // ── Activity heartbeat ──────────────────────────────────────────
    // The client emits this (throttled) on user interaction. It refreshes
    // last_seen_at so the timeout job doesn't mark active users as away,
    // and restores 'online' when the away state was set by that job.
    // A manual away/busy/dnd from Settings is never overridden here.
    socket.on('presence:active', async () => {
      try {
        if (autoAwayUsers.has(userId)) {
          autoAwayUsers.delete(userId);
          await updatePresence(userId, 'online');
        } else {
          await userRepository.touchLastSeen(userId);
        }
      } catch (err) {
        logger.warn({ err: err.message, userId }, 'Failed to process activity heartbeat');
      }
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
          try {
            const broadcastService = require('./services/broadcast.service');
            await broadcastService.syncFromMessageReceipt(msgId, userId, 'read');
          } catch (syncErr) {
            logger.warn({ err: syncErr.message, msgId }, 'Failed to sync broadcast read receipt');
          }
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
          try {
            const broadcastService = require('./services/broadcast.service');
            await broadcastService.syncFromMessageReceipt(msgId, userId, 'delivered');
          } catch (syncErr) {
            logger.warn({ err: syncErr.message, msgId }, 'Failed to sync broadcast delivery receipt');
          }
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

    // ── Llamadas: señalización WebRTC (malla P2P) ───────────────────
    // El backend solo transporta la señalización (SDP/ICE) y el ciclo de vida
    // de la llamada; el audio/vídeo viaja P2P entre los navegadores.
    registerCallHandlers(io, socket, userId);

    // ── Disconnect ──────────────────────────────────────────────────
    // 'disconnecting' aún expone socket.rooms → avisamos a las llamadas activas
    // que este participante se fue antes de que Socket.IO limpie las salas.
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('call:')) {
          socket.to(room).emit('call:peer-left', {
            callId: room.slice('call:'.length),
            userId,
          });
        }
      }
    });

    socket.on('disconnect', () => {
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');
      unregisterSocket(socket.id);
      // Grace period so F5 / tab refresh does not flash offline in DB or /me
      scheduleOffline(userId);
    });
  });

  return io;
}

// ── Señalización de llamadas ──────────────────────────────────────────
// Convención de salas: `call:{callId}` agrupa a los participantes conectados
// de una llamada. Los eventos de invitación viajan por la sala personal
// `user:{userId}` (el invitado puede no estar aún en la sala de la llamada).
function registerCallHandlers(io, socket, userId) {
  const room = (callId) => `call:${callId}`;

  // El que inicia timbra a los invitados por su sala personal y se une a la
  // sala de la llamada para quedar a la escucha de aceptaciones/rechazos.
  socket.on('call:start', ({ callId, conversationId, type, calleeIds, from }) => {
    if (!callId || !Array.isArray(calleeIds)) return;
    socket.join(room(callId));
    for (const uid of calleeIds) {
      if (uid === userId) continue;
      io.to(`user:${uid}`).emit('call:incoming', {
        callId,
        conversationId: conversationId || null,
        type,
        from,
        participantIds: [...new Set([userId, ...calleeIds])],
      });
    }
    logger.info({ callId, userId, type }, 'Call ring started');
  });

  // El invitado acepta: calcula quiénes ya están dentro (para armar la malla),
  // se une a la sala y avisa a los presentes que llegó un nuevo par.
  socket.on('call:accept', ({ callId }) => {
    if (!callId) return;
    const existing = new Set();
    const members = io.sockets.adapter.rooms.get(room(callId));
    if (members) {
      for (const sid of members) {
        const s = io.sockets.sockets.get(sid);
        if (s && s.userId !== userId) existing.add(s.userId);
      }
    }
    socket.join(room(callId));
    socket.emit('call:peers', { callId, userIds: [...existing] });
    socket.to(room(callId)).emit('call:peer-joined', { callId, userId });

    // Persistencia: la primera aceptación marca la llamada como activa (setea
    // answered_at) para que el trigger calcule la duración al finalizar.
    (async () => {
      try {
        const { callRepository } = require('./repositories');
        const call = await callRepository.findById(callId);
        if (call && call.status !== 'active') {
          await callRepository.updateStatus(callId, 'active');
        }
        await callRepository.updateParticipant(callId, userId, { status: 'joined' });
      } catch (err) {
        logger.warn({ err: err.message, callId, userId }, 'Failed to persist call accept');
      }
    })();
  });

  // Rechazo (el invitado dice que no). Los presentes en la sala se enteran.
  socket.on('call:reject', ({ callId, reason }) => {
    if (!callId) return;
    io.to(room(callId)).emit('call:rejected', { callId, userId, reason: reason || 'declined' });
  });

  // Cancelación del que llama antes de que contesten.
  socket.on('call:cancel', ({ callId, calleeIds }) => {
    if (!callId) return;
    for (const uid of calleeIds || []) {
      io.to(`user:${uid}`).emit('call:cancelled', { callId });
    }
    io.to(room(callId)).emit('call:cancelled', { callId });
  });

  // Relé de señalización dirigida (offer/answer/ICE) a un par concreto.
  socket.on('call:signal', ({ callId, to, data }) => {
    if (!callId || !to) return;
    io.to(`user:${to}`).emit('call:signal', { callId, from: userId, data });
  });

  // Un participante deja la llamada.
  socket.on('call:leave', ({ callId }) => {
    if (!callId) return;
    socket.to(room(callId)).emit('call:peer-left', { callId, userId });
    socket.leave(room(callId));
  });

  // Cambios de estado de medios (silenciar micro, apagar cámara, compartir).
  socket.on('call:media', ({ callId, kind, enabled }) => {
    if (!callId || !kind) return;
    socket.to(room(callId)).emit('call:media', { callId, userId, kind, enabled });
  });
}

async function updatePresence(userId, presence) {
  const { userRepository } = require('./repositories');
  try {
    // Any explicit presence write supersedes a job-set away.
    autoAwayUsers.delete(userId);
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
