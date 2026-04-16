import { create } from 'zustand';
import { api } from '@/lib/api';
import { authApi } from '@/lib/endpoints';

const TOKEN_KEY = 'echochat_token';
const USER_KEY = 'echochat_user';

export const useAuthStore = create((set, get) => ({
  user: (() => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } })(),
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  loading: true,

  init: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ loading: false });
      return;
    }
    api.setToken(token);
    try {
      const { data } = await authApi.me();
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      set({ user: data, isAuthenticated: true, loading: false });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        get().clearAuth();
      }
      set({ loading: false });
    }
  },

  login: async (credentials) => {
    const { data } = await authApi.login(credentials);
    const { token, user } = data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    api.setToken(token);
    set({ user, token, isAuthenticated: true });
    return data;
  },

  register: async (data) => {
    const res = await authApi.register(data);
    return res.data;
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    get().clearAuth();
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    api.clearToken();
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (userData) => {
    set((state) => {
      const updated = { ...state.user, ...userData };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return { user: updated };
    });
  },
}));
