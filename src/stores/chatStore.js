import { create } from 'zustand';
import { conversationsApi, messagesApi } from '@/lib/endpoints';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  loadingConversations: false,
  loadingMessages: false,
  hasMoreMessages: true,
  typingUsers: {},      // { conversationId: { userId: displayName, ... } }
  onlineUsers: {},      // { userId: presence }

  // ── Socket lifecycle ────────────────────────────────────────────────
  initSocket: (token) => {
    const socket = connectSocket(token);

    socket.on('message:new', (message) => {
      const state = get();
      // Add message if we're in the same conversation
      if (message.conversation_id === state.activeConversationId) {
        const exists = state.messages.some((m) => m.id === message.id);
        if (!exists) {
          set({ messages: [...state.messages, message] });
        }
      }
      // Refresh conversation list for sidebar preview
      get().fetchConversations();
    });

    socket.on('message:edited', (message) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === message.id ? { ...m, ...message } : m,
        ),
      }));
    });

    socket.on('message:deleted', ({ id }) => {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id),
      }));
    });

    socket.on('message:reaction', ({ messageId, reactions }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, reactions } : m,
        ),
      }));
    });

    socket.on('typing:start', ({ conversationId, userId, displayName }) => {
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

    socket.on('typing:stop', ({ conversationId, userId }) => {
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

    socket.on('presence:changed', ({ userId, presence }) => {
      set((state) => ({
        onlineUsers: { ...state.onlineUsers, [userId]: presence },
        conversations: state.conversations.map((c) =>
          c.other_user_id === userId || c.member_user_id === userId
            ? { ...c, member_presence: presence }
            : c,
        ),
      }));
    });
  },

  destroySocket: () => {
    disconnectSocket();
    set({ typingUsers: {}, onlineUsers: {} });
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

  fetchConversations: async () => {
    set({ loadingConversations: true });
    try {
      const { data } = await conversationsApi.list();
      console.log('Fetched conversations:', data);
      set({ conversations: data });
    } finally {
      set({ loadingConversations: false });
    }
  },

  setActiveConversation: async (conversationId) => {
    if (get().activeConversationId === conversationId) return;
    set({ activeConversationId: conversationId, messages: [], hasMoreMessages: true });
    if (conversationId) {
      await get().fetchMessages(conversationId);
      conversationsApi.markAsRead(conversationId).catch(() => {});
    }
  },

  fetchMessages: async (conversationId, cursor) => {
    set({ loadingMessages: true });
    try {
      const params = { limit: 50 };
      if (cursor) params.cursor = cursor;
      const { data } = await messagesApi.getByConversation(conversationId, params);
      const sorted = [...data].sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
      set((state) => ({
        messages: cursor ? [...sorted, ...state.messages] : sorted,
        hasMoreMessages: data.length === 50,
      }));
    } finally {
      set({ loadingMessages: false });
    }
  },

  loadMoreMessages: async () => {
    const { activeConversationId, messages, hasMoreMessages, loadingMessages } = get();
    if (!activeConversationId || !hasMoreMessages || loadingMessages) return;
    const oldest = messages[0];
    if (oldest) {
      await get().fetchMessages(activeConversationId, oldest.id);
    }
  },

  sendMessage: async (data) => {
    const res = await messagesApi.send(data);
    // Don't add locally — the socket 'message:new' event handles it for all users
    return res.data;
  },

  editMessage: async (messageId, body) => {
    await messagesApi.edit(messageId, body);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, body, is_edited: true } : m,
      ),
    }));
  },

  deleteMessage: async (messageId) => {
    await messagesApi.delete(messageId);
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));
  },

  addReaction: async (messageId, emoji) => {
    await messagesApi.addReaction(messageId, emoji);
  },

  removeReaction: async (messageId, emoji) => {
    await messagesApi.removeReaction(messageId, emoji);
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
