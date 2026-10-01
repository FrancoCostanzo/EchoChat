import { Server, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import config from './config';
import logger from './config/logger';
import { isRedisEnabled, createRedisClient } from './config/redis';
import { setSocketServer, registerSocket, unregisterSocket } from './config/socketStore';
import { isAutoAway, clearAutoAway } from './config/presenceStore';
import { onRealtime } from './config/eventBus';
import { registerCollector } from './utils/clusterMetrics';
import { authService, callService } from './services';
import broadcastService from './services/broadcast.service';
import {
  conversationRepository,
  userRepository,
  messageRepository,
  callRepository,
} from './repositories';
import type { Row } from './types/rows';

// Los servicios y repositorios se importan arriba: el ciclo que obligaba a
// cargarlos dentro de las funciones lo rompió el bus de eventos (config/eventBus.ts).

/**
 * Socket que ya pasó por el middleware de auth de más abajo, que rechaza la
 * conexión si el token no vale. Es el equivalente de `AuthRequest` en HTTP: una
 * sola afirmación en el punto donde la garantía se establece.
 */
type SocketAutenticado = Socket & { userId: string; user: Row<'users'> };

let io: Server | null = null;
const offlineTimers = new Map<string, NodeJS.Timeout>();

// Único puente entre la capa de negocio y Socket.IO: los servicios publican en
// el bus y esto los empuja a los clientes. Se registra a nivel de módulo (una
// sola vez por proceso) para que reinicializar el socket no acumule listeners.
onRealtime(({ room, event, payload }) => {
  if (!io) return; // sin servidor de sockets todavía: se descarta, como antes
  if (room) io.to(room).emit(event, payload);
  else io.emit(event, payload);
});

function cancelOfflineTimer(userId: string): void {
  const timer = offlineTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    offlineTimers.delete(userId);
  }
}

function scheduleOffline(userId: string): void {
  cancelOfflineTimer(userId);
  const timer = setTimeout(async () => {
    offlineTimers.delete(userId);
    // closeSocket limpia los temporizadores, pero si alguno llega tarde no hay
    // servidor al que preguntarle: la presencia la resolverá otra instancia.
    if (!io) return;
    try {
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (sockets.length === 0) {
        await updatePresence(userId, 'offline');
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId }, 'Failed to mark user offline');
    }
  }, 2500);
  offlineTimers.set(userId, timer);
}

async function initSocket(httpServer: HttpServer): Promise<Server> {

  const servidor = new Server(httpServer, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
    },
  });
  io = servidor;

  // ── Adapter Redis (multi-instancia) ──────────────────────────────────
  // Sin adapter, las salas (`user:*`, `conv:*`, `call:*`) sólo existen dentro de
  // este proceso: dos usuarios atendidos por instancias distintas no se verían
  // los mensajes. Con Redis, cada emisión se replica al resto de instancias.
  // Se monta antes de escuchar conexiones para que ningún socket quede aislado.
  if (isRedisEnabled()) {
    const pubClient = await createRedisClient('socket-pub');
    const subClient = await createRedisClient('socket-sub');
    servidor.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO usando adapter Redis (modo multi-instancia)');
  } else {
    logger.warn('REDIS_URL no configurado: Socket.IO en memoria, sólo una instancia (ver docs/SCALING.md)');
  }

  // Los módulos que necesitan el servidor de verdad (no sólo emitir) lo reciben
  // acá, en vez de ir a buscarlo con un require perezoso.
  setSocketServer(servidor);
  registerCollector(servidor);

  // ── Auth middleware ──────────────────────────────────────────────────
  servidor.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const { user } = await authService.validateToken(token);
      const autenticado = socket as SocketAutenticado;
      autenticado.userId = user.id;
      autenticado.user = user;
      // `data` es lo único que Socket.IO serializa al consultar sockets de otras
      // instancias con fetchSockets(): las props sueltas del socket no viajan.
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  servidor.on('connection', async (conexion) => {
    const socket = conexion as SocketAutenticado;
    const userId = socket.userId;
    logger.info({ userId, socketId: socket.id }, 'Socket connected');
    registerSocket(socket.id, userId);

    // Join a personal room for direct events
    socket.join(`user:${userId}`);

    // ── Llamadas: señalización WebRTC (malla P2P) ───────────────────
    // El backend solo transporta la señalización (SDP/ICE) y el ciclo de vida
    // de la llamada; el audio/vídeo viaja P2P entre los navegadores. Se
    // registra antes de los await de abajo: un timbre emitido apenas conecta
    // el socket se perdía mientras se consultaba la base.
    registerCallHandlers(servidor, socket, userId);
    // Llamadas que le estaban sonando mientras no tenía la app abierta (por
    // ejemplo, si la abre tocando "Atender" en la notificación push).
    callService.pendingRingsFor(userId)
      .then((rings) => { for (const ring of rings) socket.emit('call:incoming', ring); })
      .catch((err: Error) => logger.warn({ err: err.message, userId }, 'Failed to resend pending rings'));

    // Join all conversation rooms this user belongs to
    try {
      const conversations = await conversationRepository.findUserConversations(userId);
      for (const conv of conversations) {
        socket.join(`conv:${conv.id}`);
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId }, 'Failed to join conversation rooms');
    }

    // ── Restore presence on connect (debounced disconnect avoids F5 → offline) ─
    cancelOfflineTimer(userId);
    try {
      const dbUser = await userRepository.findById(userId);
      if (dbUser?.presence === 'offline') {
        await updatePresence(userId, 'online');
      } else if (dbUser?.presence) {
        await userRepository.updatePresence(userId, dbUser.presence);
        servidor.emit('presence:changed', { userId, presence: dbUser.presence });
      } else {
        await updatePresence(userId, 'online');
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId }, 'Failed to restore presence on connect');
      await updatePresence(userId, 'online');
    }

    // ── Join a new conversation room (when creating/entering one) ───
    socket.on('join:conversation', (conversationId: string) => {
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
        logger.warn({ err: (err as Error).message, userId }, 'Failed to process activity heartbeat');
      }
    });

    // ── Typing indicators ───────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId,
        displayName: socket.user.display_name,
      });
    });

    socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId,
      });
    });

    // ── Read receipts ───────────────────────────────────────────────
    socket.on('messages:read', async ({ conversationId, messageIds }: { conversationId?: string; messageIds?: string[] }) => {
      if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) return;
      try {
        for (const msgId of messageIds) {
          await messageRepository.addReceipt(msgId, userId, 'read');
          try {
            await broadcastService.syncFromMessageReceipt(msgId, userId, 'read');
          } catch (syncErr) {
            logger.warn({ err: (syncErr as Error).message, msgId }, 'Failed to sync broadcast read receipt');
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
        logger.warn({ err: (err as Error).message, userId }, 'Failed to process read receipts');
      }
    });

    // ── Mark delivered (cuando un mensaje llega al cliente pero no se lee) ──
    socket.on('messages:delivered', async ({ conversationId, messageIds }: { conversationId?: string; messageIds?: string[] }) => {
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;
      try {
        for (const msgId of messageIds) {
          await messageRepository.addReceipt(msgId, userId, 'delivered');
          try {
            await broadcastService.syncFromMessageReceipt(msgId, userId, 'delivered');
          } catch (syncErr) {
            logger.warn({ err: (syncErr as Error).message, msgId }, 'Failed to sync broadcast delivery receipt');
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
          servidor.to(room).emit('message:receipt', {
            messageId: msgId,
            delivered_count: Number(counts.delivered_count) || 0,
            read_count: Number(counts.read_count) || 0,
          });
        }
      } catch (err) {
        logger.warn({ err: (err as Error).message, userId }, 'Failed to process delivery receipts');
      }
    });

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

  return servidor;
}

// ── Señalización de llamadas ──────────────────────────────────────────
// Convención de salas: `call:{callId}` agrupa a los participantes conectados
// de una llamada. Los eventos de invitación viajan por la sala personal
// `user:{userId}` (el invitado puede no estar aún en la sala de la llamada).
//
// Todo lo que llega del cliente se valida contra `call_participants`: sólo
// quien inició la llamada puede timbrar o cancelar, sólo un participante
// puede entrar a la sala, y la señalización sólo se relaya entre participantes.
// Los invitados y el `from` del timbre salen de la base, nunca del cliente.
function registerCallHandlers(io: Server, socket: SocketAutenticado, userId: string): void {
  const room = (callId: string) => `call:${callId}`;

  // callId -> resto de participantes, validado al iniciar o aceptar. Lo usa
  // `call:signal`, que llega por cada SDP/ICE, para no volver a la base.
  const peersByCall = new Map<string, Set<string>>();

  // El que inicia timbra a los invitados por su sala personal y se une a la
  // sala de la llamada para quedar a la escucha de aceptaciones/rechazos.
  socket.on('call:start', async ({ callId }: { callId?: string }) => {
    try {
      const found = await callService.getPeers(callId, userId, { liveOnly: true });
      if (!found || found.call.initiated_by !== userId) return;
      const { call, peerIds } = found;

      peersByCall.set(call.id, new Set(peerIds));
      socket.join(room(call.id));
      const from = await callService.describeCaller(socket.user);
      for (const uid of peerIds) {
        io.to(`user:${uid}`).emit('call:incoming', {
          callId: call.id,
          conversationId: call.conversation_id,
          type: call.type,
          from,
          participantIds: [userId, ...peerIds],
        });
      }
      void callService.pushRing(call, from.display_name, peerIds);
      logger.info({ callId: call.id, userId, type: call.type }, 'Call ring started');
    } catch (err) {
      logger.warn({ err: (err as Error).message, callId, userId }, 'Failed to start call ring');
    }
  });

  // El invitado acepta: calcula quiénes ya están dentro (para armar la malla),
  // se une a la sala y avisa a los presentes que llegó un nuevo par.
  socket.on('call:accept', async ({ callId }: { callId?: string }) => {
    let found: Awaited<ReturnType<typeof callService.getPeers>>;
    try {
      found = await callService.getPeers(callId, userId);
    } catch (err) {
      logger.warn({ err: (err as Error).message, callId, userId }, 'Failed to authorize call accept');
      return;
    }
    if (!found) return;
    const id = found.call.id;
    peersByCall.set(id, new Set(found.peerIds));

    // fetchSockets() consulta también las otras instancias; `io.sockets.adapter.rooms`
    // y `io.sockets.sockets` sólo verían a los participantes de este proceso.
    const existing = new Set<string>();
    try {
      const members = await io.in(room(id)).fetchSockets();
      for (const s of members) {
        const memberId = s.data?.userId;
        if (memberId && memberId !== userId) existing.add(memberId);
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, callId: id }, 'Failed to list call participants');
    }
    socket.join(room(id));
    socket.emit('call:peers', { callId: id, userIds: [...existing] });
    socket.to(room(id)).emit('call:peer-joined', { callId: id, userId });
    // Atendió en esta sesión: que deje de sonar en sus otras pestañas/dispositivos.
    socket.to(`user:${userId}`).emit('call:cancelled', { callId: id });

    // Persistencia: la primera aceptación marca la llamada como activa (setea
    // answered_at) para que el trigger calcule la duración al finalizar.
    (async () => {
      try {
        if (found.call.status !== 'active') {
          await callRepository.updateStatus(id, 'active');
        }
        await callRepository.updateParticipant(id, userId, { status: 'joined' });
      } catch (err) {
        logger.warn({ err: (err as Error).message, callId: id, userId }, 'Failed to persist call accept');
      }
    })();
  });

  // Rechazo (el invitado dice que no). Los presentes en la sala se enteran.
  socket.on('call:reject', async ({ callId, reason }: { callId?: string; reason?: string }) => {
    try {
      const found = await callService.getPeers(callId, userId);
      if (!found) return;
      await callService.decline(found.call.id, userId, reason === 'busy' ? 'busy' : 'declined');
    } catch (err) {
      logger.warn({ err: (err as Error).message, callId, userId }, 'Failed to relay call reject');
    }
  });

  // Cancelación del que llama antes de que contesten.
  socket.on('call:cancel', async ({ callId }: { callId?: string }) => {
    try {
      const found = await callService.getPeers(callId, userId);
      if (!found || found.call.initiated_by !== userId) return;
      for (const uid of found.peerIds) {
        io.to(`user:${uid}`).emit('call:cancelled', { callId: found.call.id });
      }
      io.to(room(found.call.id)).emit('call:cancelled', { callId: found.call.id });
    } catch (err) {
      logger.warn({ err: (err as Error).message, callId, userId }, 'Failed to relay call cancel');
    }
  });

  // Relé de señalización dirigida (offer/answer/ICE) a un par concreto.
  socket.on('call:signal', ({ callId, to, data }: { callId?: string; to?: string; data?: unknown }) => {
    if (!callId || !to || !socket.rooms.has(room(callId))) return;
    if (!peersByCall.get(callId)?.has(to)) return;
    io.to(`user:${to}`).emit('call:signal', { callId, from: userId, data });
  });

  // Un participante deja la llamada.
  socket.on('call:leave', ({ callId }: { callId?: string }) => {
    if (!callId) return;
    peersByCall.delete(callId);
    if (!socket.rooms.has(room(callId))) return;
    socket.to(room(callId)).emit('call:peer-left', { callId, userId });
    socket.leave(room(callId));
  });

  // Cambios de estado de medios (silenciar micro, apagar cámara, compartir).
  socket.on('call:media', ({ callId, kind, enabled }: { callId?: string; kind?: string; enabled?: boolean }) => {
    if (!callId || !kind || !socket.rooms.has(room(callId))) return;
    socket.to(room(callId)).emit('call:media', { callId, userId, kind, enabled });
  });
}

async function updatePresence(userId: string, presence: string): Promise<void> {
  try {
    // Any explicit presence write supersedes a job-set away.
    await clearAutoAway(userId);
    await userRepository.updatePresence(userId, presence);
    // Broadcast presence change to all users who share a conversation
    io?.emit('presence:changed', { userId, presence });
  } catch (err) {
    logger.warn({ err: (err as Error).message, userId }, 'Failed to update presence');
  }
}

function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

/**
 * Cierra Socket.IO (y con él el servidor HTTP que tiene adosado), desconectando
 * a los clientes para que se reconecten contra otra instancia. Se llama antes
 * de cerrar Redis, porque el adapter usa esos clientes.
 */
async function closeSocket(): Promise<void> {
  if (!io) return;
  for (const timer of offlineTimers.values()) clearTimeout(timer);
  offlineTimers.clear();
  const instance = io;
  io = null;
  setSocketServer(null);
  await new Promise<void>((resolve) => instance.close(() => resolve()));
}

export { initSocket, getIO, closeSocket };
