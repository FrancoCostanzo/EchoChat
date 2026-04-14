import { create } from 'zustand';
import { conversationsApi, messagesApi } from '@/lib/endpoints';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  loadingConversations: false,
  loadingMessages: false,
  hasMoreMessages: true,

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
    set((state) => ({ messages: [...state.messages, res.data] }));
    // refresh conversations to update last message
    get().fetchConversations();
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
