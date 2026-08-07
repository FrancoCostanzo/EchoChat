const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('./config');
const logger = require('./config/logger');
const { isRedisEnabled, createRedisClient } = require('./config/redis');
const { setSocketServer, registerSocket, unregisterSocket } = require('./config/socketStore');
const { isAutoAway, clearAutoAway } = require('./config/presenceStore');
const { onRealtime } = require('./config/eventBus');
const { registerCollector } = require('./utils/clusterMetrics');
const { authService } = require('./services');
const broadcastService = require('./services/broadcast.service');
const {
  conversationRepository,
  userRepository,
  messageRepository,
  callRepository,
} = require('./repositories');

// Los servicios y repositorios se importan arriba: el ciclo que obligaba a
// cargarlos dentro de las funciones lo rompió el bus de eventos (config/eventBus.js).

let io;
const offlineTimers = new Map();

// Único puente entre la capa de negocio y Socket.IO: los servicios publican en
// el bus y esto los empuja a los clientes. Se registra a nivel de módulo (una
// sola vez por proceso) para que reinicializar el socket no acumule listeners.
onRealtime(({ room, event, payload }) => {
  if (!io) return; // sin servidor de sockets todavía: se descarta, como antes
  if (room) io.to(room).emit(event, payload);
  else io.emit(event, payload);
});

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

async function initSocket(httpServer) {

  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
  });

  // ── Adapter Redis (multi-instancia) ──────────────────────────────────
  // Sin adapter, las salas (`user:*`, `conv:*`, `call:*`) sólo existen dentro de
  // este proceso: dos usuarios atendidos por instancias distintas no se verían
  // los mensajes. Con Redis, cada emisión se replica al resto de instancias.
  // Se monta antes de escuchar conexiones para que ningún socket quede aislado.
  if (isRedisEnabled()) {
    const pubClient = await createRedisClient('socket-pub');
    const subClient = await createRedisClient('socket-sub');
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO usando adapter Redis (modo multi-instancia)');
  } else {
    logger.warn('REDIS_URL no configurado: Socket.IO en memoria, sólo una instancia (ver docs/SCALING.md)');
  }

  // Los módulos que necesitan el servidor de verdad (no sólo emitir) lo reciben
  // acá, en vez de ir a buscarlo con un require perezoso.
  setSocketServer(io);
  registerCollector(io);

  // ── Auth middleware ──────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const { user } = await authService.validateToken(token);
      socket.userId = user.id;
      socket.user = user;
      // `data` es lo único que Socket.IO serializa al consultar sockets de otras
      // instancias con fetchSockets(): las props sueltas del socket no viajan.
      socket.data.userId = user.id;
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
        if (await isAutoAway(userId)) {
          // updatePresence ya borra la marca de auto-away.
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
      try {
        for (const msgId of messageIds) {
          await messageRepository.addReceipt(msgId, userId, 'read');
          try {
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
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;
      try {
        for (const msgId of messageIds) {
          await messageRepository.addReceipt(msgId, userId, 'delivered');
          try {
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
  socket.on('call:accept', async ({ callId }) => {
    if (!callId) return;
    // fetchSockets() consulta también las otras instancias; `io.sockets.adapter.rooms`
    // y `io.sockets.sockets` sólo verían a los participantes de este proceso.
    const existing = new Set();
    try {
      const members = await io.in(room(callId)).fetchSockets();
      for (const s of members) {
        const memberId = s.data?.userId;
        if (memberId && memberId !== userId) existing.add(memberId);
      }
    } catch (err) {
      logger.warn({ err: err.message, callId }, 'Failed to list call participants');
    }
    socket.join(room(callId));
    socket.emit('call:peers', { callId, userIds: [...existing] });
    socket.to(room(callId)).emit('call:peer-joined', { callId, userId });

    // Persistencia: la primera aceptación marca la llamada como activa (setea
    // answered_at) para que el trigger calcule la duración al finalizar.
    (async () => {
      try {
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
  try {
    // Any explicit presence write supersedes a job-set away.
    await clearAutoAway(userId);
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

/**
 * Cierra Socket.IO (y con él el servidor HTTP que tiene adosado), desconectando
 * a los clientes para que se reconecten contra otra instancia. Se llama antes
 * de cerrar Redis, porque el adapter usa esos clientes.
 */
async function closeSocket() {
  if (!io) return;
  for (const timer of offlineTimers.values()) clearTimeout(timer);
  offlineTimers.clear();
  const instance = io;
  io = null;
  setSocketServer(null);
  await new Promise((resolve) => instance.close(() => resolve()));
}

module.exports = { initSocket, getIO, closeSocket };
