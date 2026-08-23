import { create } from 'zustand';
import { api, ApiError } from '@/lib/api';
import { authApi } from '@/lib/endpoints';
import type { UserResponse, AuthenticatedUser } from '@/types/user';
import type { LoginRequest, RegisterRequest, DeviceType, AuthSuccessResponse } from '@/types/auth';

const TOKEN_KEY = 'echochat_token';
const USER_KEY = 'echochat_user';

let initPromise: Promise<void> | null = null;

interface AuthState {
  user: AuthenticatedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** holds temp_token while waiting for TOTP code */
  pending2fa: string | null;

  init: () => Promise<void>;
  login: (credentials: LoginRequest) => Promise<{ requires2fa: true } | AuthSuccessResponse>;
  verify2fa: (code: string, deviceType?: DeviceType) => Promise<AuthSuccessResponse>;
  loginWithToken: (token: string) => Promise<AuthenticatedUser>;
  cancelPending2fa: () => void;
  register: (data: RegisterRequest) => Promise<UserResponse | null>;
  logout: () => Promise<void>;
  clearAuth: () => void;
  updateUser: (userData: Partial<AuthenticatedUser>) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: (() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as AuthenticatedUser | null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  loading: true,
  pending2fa: null,

  init: () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
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
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          get().clearAuth();
        }
        set({ loading: false });
      }
    })();
    return initPromise;
  },

  login: async (credentials) => {
    const { data } = await authApi.login(credentials);
    if ('requires_2fa' in data) {
      set({ pending2fa: data.temp_token });
      return { requires2fa: true };
    }
    const { token, user } = data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    api.setToken(token);
    set({ user, token, isAuthenticated: true, pending2fa: null });
    return data;
  },

  verify2fa: async (code, deviceType = 'web') => {
    const tempToken = get().pending2fa;
    if (!tempToken) throw new Error('No pending 2FA challenge');
    const { data } = await authApi.verify2faChallenge({
      temp_token: tempToken,
      code,
      device_type: deviceType,
    });
    const { token, user } = data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    api.setToken(token);
    set({ user, token, isAuthenticated: true, pending2fa: null });
    return data;
  },

  // Login por SSO: el token llega ya emitido (en el fragmento del callback), sólo
  // resta persistirlo y traer el perfil. Reutiliza el mismo estado que el login local.
  loginWithToken: async (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    api.setToken(token);
    const { data } = await authApi.me();
    localStorage.setItem(USER_KEY, JSON.stringify(data));
    set({ user: data, token, isAuthenticated: true, pending2fa: null });
    return data;
  },

  cancelPending2fa: () => set({ pending2fa: null }),

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
    set({ user: null, token: null, isAuthenticated: false, pending2fa: null });
  },

  updateUser: (userData) => {
    set((state) => {
      const updated = { ...state.user, ...userData } as AuthenticatedUser;
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return { user: updated };
    });
  },
}));
