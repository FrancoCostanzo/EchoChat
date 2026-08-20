import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import { conversationsApi, messagesApi } from '@/lib/endpoints';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import type { ConversationResponse, CreateConversationRequest } from '@/types/conversation';
import type { MessageResponse, MessageReaction, MessageBodyFormat, SendMessageRequest } from '@/types/message';
import type { PollResponse } from '@/types/poll';
import type { GameResponse } from '@/types/game';

/**
 * Un mensaje en el timeline puede estar en tránsito (envío optimista antes de
 * que responda el backend): estos campos `_*` sólo existen en el cliente,
 * nunca vienen de la API.
 */
export type ChatMessage = MessageResponse & {
  _status?: 'sending' | 'sent' | 'error';
  _tempId?: string;
  _rawData?: Record<string, unknown>;
  _animateIn?: boolean;
  _filename?: string | null;
};

type TypingUsers = Record<string, Record<string, string>>;
/** userId -> presence */
type OnlineUsers = Record<string, string>;

// Tracks in-flight fetchMessages calls by conversationId so that concurrent
// calls (e.g. React StrictMode's double-invoke) await the same Promise instead
// of firing duplicate HTTP requests.
const _inFlightFetch = new Map<string, Promise<void>>();

// Activity heartbeat: tells the backend the user is interacting so the
// presence timeout job doesn't mark them away (and restores online if it
// already did). Throttled — with a 5 min server timeout, one ping per minute
// of activity is plenty.
const ACTIVITY_THROTTLE_MS = 60_000;
let _activityCleanup: (() => void) | null = null;

function startActivityHeartbeat(socket: Socket): void {
  _activityCleanup?.();
  let lastPing = 0;
  const ping = () => {
    const now = Date.now();
    if (now - lastPing < ACTIVITY_THROTTLE_MS) return;
    lastPing = now;
    if (socket.connected) socket.emit('presence:active');
  };
  const onVisible = () => { if (!document.hidden) ping(); };
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
  for (const ev of events) window.addEventListener(ev, ping, { passive: true });
  document.addEventListener('visibilitychange', onVisible);
  _activityCleanup = () => {
    for (const ev of events) window.removeEventListener(ev, ping);
    document.removeEventListener('visibilitychange', onVisible);
    _activityCleanup = null;
  };
}

// Last rendered timeline per conversation. Switching back to a recently
// visited chat paints the cached messages instantly (no blank/skeleton flash)
// while a background fetch reconciles anything received meanwhile.
interface CachedTimeline {
  messages: ChatMessage[];
  hasMoreMessages: boolean;
}
const _messageCache = new Map<string, CachedTimeline>();
const MESSAGE_CACHE_LIMIT = 15;

function cacheMessages(conversationId: string | null, messages: ChatMessage[], hasMoreMessages: boolean): void {
  if (!conversationId || !messages?.length) return;
  // Optimistic sends stay out of the cache — a revisit refetches the truth.
  const settled = messages.filter((m) => !m._status || m._status === 'sent');
  _messageCache.delete(conversationId); // refresh insertion order (LRU)
  _messageCache.set(conversationId, { messages: settled, hasMoreMessages });
  if (_messageCache.size > MESSAGE_CACHE_LIMIT) {
    const oldest = _messageCache.keys().next().value;
    if (oldest !== undefined) _messageCache.delete(oldest);
  }
}

interface ChatState {
  conversations: ConversationResponse[];
  activeConversationId: string | null;
  activeUserId: string | null;
  messages: ChatMessage[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  /** { conversationId: { userId: displayName, ... } } */
  typingUsers: TypingUsers;
  /** { userId: presence } */
  onlineUsers: OnlineUsers;

  initSocket: (token: string, userId: string) => void;
  destroySocket: () => void;
  emitTyping: (conversationId: string, isTyping: boolean) => void;
  joinConversation: (conversationId: string) => void;
  markMessagesRead: (conversationId: string, messageIds: string[]) => void;
  markMessagesDelivered: (conversationId: string, messageIds: string[]) => void;
  clearActiveConversation: () => void;
  fetchConversations: () => Promise<void>;
  setActiveConversation: (conversationId: string | null) => Promise<void>;
  fetchMessages: (conversationId: string, cursor?: string) => Promise<void>;
  patchMessage: (messageId: string, patch: Partial<ChatMessage>) => void;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (
    data: SendMessageRequest & { _filename?: string | null },
    senderInfo?: { id?: string; display_name?: string },
  ) => Promise<MessageResponse>;
  retrySendMessage: (tempId: string) => Promise<void>;
  editMessage: (messageId: string, body: string, bodyFormat?: MessageBodyFormat) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  applyPollUpdate: (messageId: string, poll: PollResponse, opts?: { preserveVotes?: boolean }) => void;
  applyGameUpdate: (messageId: string, game: GameResponse) => void;
  addLocalMessage: (message: ChatMessage) => void;
  createConversation: (data: CreateConversationRequest) => Promise<ConversationResponse>;
  getActiveConversation: () => ConversationResponse | undefined;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeUserId: null,
  messages: [],
  loadingConversations: false,
  loadingMessages: false,
  hasMoreMessages: true,
  typingUsers: {},
  onlineUsers: {},

  // ── Socket lifecycle ────────────────────────────────────────────────
  initSocket: (token, userId) => {
    set({ activeUserId: userId });
    const socket = connectSocket(token);

    // Registrar los listeners de señalización de llamadas sobre el mismo socket.
    // `connect` cubre la reconexión; también lo intentamos ya por si está listo.
    const attachCalls = () => useCallStore.getState().attach(userId);
    socket.on('connect', attachCalls);
    if (socket.connected) attachCalls();

    startActivityHeartbeat(socket);

    socket.on('message:new', (message: ChatMessage) => {
      const state = get();
      // Thread replies don't enter the main timeline — the ThreadPanel has its
      // own listener and the root's counter updates via message:thread_count.
      if (message.thread_id) return;

      const knownConversation = state.conversations.some((c) => c.id === message.conversation_id);
      // Broadcast (and any new DM) may create a conversation the client hasn't
      // joined or listed yet — pull it in so the message isn't invisible.
      if (!knownConversation && message.conversation_id) {
        get().joinConversation(message.conversation_id);
        get().fetchConversations();
      }

      // Add message if we're in the same conversation
      if (message.conversation_id === state.activeConversationId) {
        const exists = state.messages.some((m) => m.id === message.id);
        if (!exists) {
          set({ messages: [...state.messages, { ...message, _animateIn: true }] });
          // Auto-mark as read since the user is actively viewing this conversation
          const currentUser = state.activeUserId;
          if (message.sender_id !== currentUser) {
            get().markMessagesRead(message.conversation_id, [message.id]);
          }
        }
      } else if (message.sender_id !== state.activeUserId) {
        // No la estoy mirando: el mensaje llegó a mi cliente pero aún no lo leo.
        // Registramos el recibo de "entregado" para que el emisor pueda
        // distinguir entregado vs. leído en la info del mensaje.
        get().markMessagesDelivered(message.conversation_id, [message.id]);
      }
      // Update conversation preview locally — no GET needed
      set((state) => {
        const updated = state.conversations.map((c) =>
          c.id === message.conversation_id
            ? {
                ...c,
                last_message_body: message.type === 'media' ? null : (message.body || null),
                last_message_type: message.type,
                last_message_metadata: message.metadata || null,
                last_message_at: message.sent_at,
                unread_count:
                  message.conversation_id !== state.activeConversationId &&
                  message.sender_id !== state.activeUserId
                    ? (c.unread_count || 0) + 1
                    : c.unread_count,
              }
            : c,
        );
        const target = updated.find((c) => c.id === message.conversation_id);
        // El mensaje llegó → el remitente ya no está "escribiendo".
        const convTyping = { ...state.typingUsers[message.conversation_id] };
        if (message.sender_id) delete convTyping[message.sender_id];
        return {
          conversations: target
            ? [target, ...updated.filter((c) => c.id !== message.conversation_id)]
            : updated,
          typingUsers: { ...state.typingUsers, [message.conversation_id]: convTyping },
        };
      });
    });

    socket.on('message:edited', (message: { id: string } & Partial<ChatMessage>) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === message.id ? { ...m, ...message } : m,
        ),
      }));
    });

    socket.on('message:deleted', (message: { id: string } & Partial<ChatMessage>) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === message.id ? { ...m, ...message } : m,
        ),
      }));
    });

    socket.on('message:thread_count', ({ messageId, thread_count }: { messageId: string; thread_count: number }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, thread_count } : m,
        ),
      }));
    });

    socket.on('message:reaction', ({ messageId, reactions }: { messageId: string; reactions: MessageReaction[] }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, reactions } : m,
        ),
      }));
    });

    socket.on('typing:start', ({ conversationId, userId, displayName }: { conversationId: string; userId: string; displayName: string }) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: {
            ...state.typingUsers[conversationId],
            [userId]: displayName,
          },
        },
      }));
    });

    socket.on('typing:stop', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      set((state) => {
        const conv = { ...state.typingUsers[conversationId] };
        delete conv[userId];
        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: conv,
          },
        };
      });
    });

    socket.on('message:receipt', ({ messageId, delivered_count, read_count }: { messageId: string; delivered_count: number; read_count: number }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, delivered_count, read_count } : m,
        ),
      }));
    });

    socket.on('messages:read', ({ countsMap }: { countsMap?: Record<string, { delivered_count: number; read_count: number }> }) => {
      if (!countsMap) return;
      set((state) => ({
        messages: state.messages.map((m) =>
          countsMap[m.id]
            ? { ...m, delivered_count: countsMap[m.id].delivered_count, read_count: countsMap[m.id].read_count }
            : m,
        ),
      }));
    });

    socket.on('poll:update', ({ messageId, poll }: { messageId: string; poll: PollResponse }) => {
      // Trust server vote counts but keep this client's own vote selection.
      get().applyPollUpdate(messageId, poll, { preserveVotes: true });
    });

    socket.on('game:update', ({ messageId, game }: { messageId: string; game: GameResponse }) => {
      get().applyGameUpdate(messageId, game);
    });

    socket.off('presence:changed');
    socket.on('presence:changed', ({ userId, presence }: { userId: string; presence: string }) => {
      set((state) => ({
        onlineUsers: { ...state.onlineUsers, [userId]: presence },
        conversations: state.conversations.map((c) =>
          c.other_user_id === userId || (c as ConversationResponse & { member_user_id?: string }).member_user_id === userId
            ? { ...c, member_presence: presence }
            : c,
        ),
      }));
      if (userId === get().activeUserId) {
        useAuthStore.getState().updateUser({ presence });
      }
    });
  },

  destroySocket: () => {
    _activityCleanup?.();
    useCallStore.getState().detach();
    disconnectSocket();
    set({ typingUsers: {}, onlineUsers: {}, activeUserId: null });
  },

  emitTyping: (conversationId, isTyping) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
  },

  joinConversation: (conversationId) => {
    const socket = getSocket();
    if (socket) socket.emit('join:conversation', conversationId);
  },

  markMessagesRead: (conversationId, messageIds) => {
    if (!conversationId || !messageIds?.length) return;
    const socket = getSocket();
    if (socket) socket.emit('messages:read', { conversationId, messageIds });
  },

  markMessagesDelivered: (conversationId, messageIds) => {
    if (!messageIds?.length) return;
    const socket = getSocket();
    if (socket) socket.emit('messages:delivered', { conversationId, messageIds });
  },

  clearActiveConversation: () => {
    const { activeConversationId, messages, hasMoreMessages } = get();
    cacheMessages(activeConversationId, messages, hasMoreMessages);
    set({ activeConversationId: null, messages: [] });
  },

  fetchConversations: async () => {
    set({ loadingConversations: true });
    try {
      const { data } = await conversationsApi.list();
      set({ conversations: data });
    } finally {
      set({ loadingConversations: false });
    }
  },

  setActiveConversation: async (conversationId) => {
    const state = get();
    if (state.activeConversationId === conversationId) return;
    // Park the outgoing conversation's timeline so coming back is instant.
    cacheMessages(state.activeConversationId, state.messages, state.hasMoreMessages);
    // Always restore activeConversationId synchronously so the UI never gets
    // stuck — clearActiveConversation (called by StrictMode cleanup) may have
    // nulled it between the two effect invocations.
    const cached = conversationId ? _messageCache.get(conversationId) : undefined;
    set({
      activeConversationId: conversationId,
      messages: cached?.messages ?? [],
      hasMoreMessages: cached?.hasMoreMessages ?? true,
    });
    if (!conversationId) return;

    // If another call is already fetching this conversation (StrictMode double-
    // invoke), await the same Promise and skip duplicate side effects.
    if (_inFlightFetch.has(conversationId)) {
      await _inFlightFetch.get(conversationId);
      return;
    }

    const fetchPromise = get().fetchMessages(conversationId)
      .finally(() => _inFlightFetch.delete(conversationId));
    _inFlightFetch.set(conversationId, fetchPromise);
    await fetchPromise;

    // Optimistically clear unread badge
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c,
      ),
    }));
    conversationsApi.markAsRead(conversationId).catch(() => {});
  },

  fetchMessages: async (conversationId, cursor) => {
    set({ loadingMessages: true });
    try {
      const params: { limit: number; cursor?: string } = { limit: 50 };
      if (cursor) params.cursor = cursor;
      const { data } = await messagesApi.getByConversation(conversationId, params);
      const sorted = [...data].sort((a, b) => new Date(a.sent_at ?? 0).getTime() - new Date(b.sent_at ?? 0).getTime());
      set((state) => {
        // Ignore stale responses after switching conversations
        if (state.activeConversationId !== conversationId) return state;
        return {
          messages: cursor ? [...sorted, ...state.messages] : sorted,
          hasMoreMessages: data.length === 50,
        };
      });
      // Mark all loaded messages from others as read on initial load
      if (!cursor) {
        const { activeUserId } = get();
        const unreadIds = sorted
          .filter((m) => m.sender_id !== activeUserId)
          .map((m) => m.id);
        if (unreadIds.length > 0) get().markMessagesRead(conversationId, unreadIds);
      }
    } finally {
      set({ loadingMessages: false });
    }
  },

  patchMessage: (messageId, patch) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, ...patch } : m,
      ),
    }));
  },

  loadMoreMessages: async () => {
    const { activeConversationId, messages, hasMoreMessages, loadingMessages } = get();
    if (!activeConversationId || !hasMoreMessages || loadingMessages) return;
    const oldest = messages[0];
    if (oldest) {
      await get().fetchMessages(activeConversationId, oldest.id);
    }
  },

  sendMessage: async (data, senderInfo) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { _filename, ...apiData } = data;

    // Populate reply preview from local messages for instant display
    let replyPreview: Partial<ChatMessage> = {};
    if (data.reply_to_id) {
      const replyMsg = get().messages.find((m) => m.id === data.reply_to_id);
      if (replyMsg) {
        replyPreview = {
          reply_to_body: replyMsg.body,
          reply_to_type: replyMsg.type,
          reply_to_sender: replyMsg.sender_display_name,
        };
      }
    }

    const optimisticMsg: ChatMessage = {
      id: tempId,
      _tempId: tempId,
      _rawData: apiData,
      conversation_id: data.conversation_id,
      sender_id: senderInfo?.id ?? null,
      sender_display_name: senderInfo?.display_name,
      body: data.type === 'media' ? null : (data.body || null),
      body_format: data.body_format || 'plain',
      type: data.type || 'text',
      metadata: data.metadata || null,
      sent_at: new Date().toISOString(),
      is_edited: false,
      is_deleted: false,
      reply_to_id: data.reply_to_id || null,
      ...replyPreview,
      attachments: [],
      reactions: [],
      delivered_count: 0,
      read_count: 0,
      _status: 'sending',
      _filename: _filename || null,
    } as ChatMessage;

    set((state) => ({ messages: [...state.messages, optimisticMsg] }));

    try {
      const res = await messagesApi.send(apiData);
      const realMsg = res.data;
      // Remove any socket-added duplicate then replace temp with real message
      set((state) => ({
        messages: state.messages
          .filter((m) => m.id !== realMsg.id)
          .map((m) => (m.id === tempId ? { ...realMsg, _status: 'sent' } : m)),
      }));
      return realMsg;
    } catch (err) {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempId ? { ...m, _status: 'error' } : m,
        ),
      }));
      throw err;
    }
  },

  retrySendMessage: async (tempId) => {
    const msg = get().messages.find((m) => m.id === tempId);
    if (!msg?._rawData) return;
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === tempId ? { ...m, _status: 'sending' } : m,
      ),
    }));
    try {
      const res = await messagesApi.send(msg._rawData as unknown as SendMessageRequest);
      const realMsg = res.data;
      set((state) => ({
        messages: state.messages
          .filter((m) => m.id !== realMsg.id)
          .map((m) => (m.id === tempId ? { ...realMsg, _status: 'sent' } : m)),
      }));
    } catch {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempId ? { ...m, _status: 'error' } : m,
        ),
      }));
    }
  },

  editMessage: async (messageId, body, bodyFormat) => {
    const payload = { body, body_format: bodyFormat };
    const res = await messagesApi.edit(messageId, payload);
    const updated = res.data;
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, body, body_format: updated.body_format ?? bodyFormat ?? null, is_edited: true }
          : m,
      ),
    }));
  },

  deleteMessage: async (messageId) => {
    const res = await messagesApi.delete(messageId);
    const deleted = res?.data;
    // Soft-delete: keep the row and show the "deleted" placeholder (same as
    // after refresh / message:deleted). Never remove it from the timeline.
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              ...(deleted || {}),
              is_deleted: true,
              body: null,
              type: 'deleted_placeholder',
              attachments: [],
              reactions: [],
            }
          : m,
      ),
    }));
  },

  addReaction: async (messageId, emoji) => {
    await messagesApi.addReaction(messageId, emoji);
  },

  removeReaction: async (messageId, emoji) => {
    await messagesApi.removeReaction(messageId, emoji);
  },

  // Update the embedded poll of a message. When preserveVotes is true (realtime
  // broadcast), the incoming `voted` flags belong to the actor, so we keep the
  // local user's own selection and only adopt the authoritative counts.
  applyPollUpdate: (messageId, poll, { preserveVotes = false } = {}) => {
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId || !m.poll) return m;
        if (!preserveVotes) return { ...m, poll };
        const mine = new Set(m.poll.options.filter((o) => o.voted).map((o) => o.id));
        return {
          ...m,
          poll: {
            ...poll,
            has_voted: m.poll.has_voted,
            options: poll.options.map((o) => ({ ...o, voted: mine.has(o.id) })),
          },
        };
      }),
    }));
  },

  // Each `game:update` arrives already redacted for this viewer (server-side),
  // so unlike polls there's nothing to merge locally — just replace it.
  applyGameUpdate: (messageId, game) => {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === messageId ? { ...m, game } : m)),
    }));
  },

  addLocalMessage: (message) => {
    set((state) => {
      if (message.conversation_id !== state.activeConversationId) return state;
      return { messages: [...state.messages, message] };
    });
  },

  createConversation: async (data) => {
    const res = await conversationsApi.create(data);
    await get().fetchConversations();
    return res.data;
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId);
  },
}));
