import { create } from 'zustand';
import { wallpaperApi } from '@/lib/endpoints';

function normKey(scope, scopeKey) {
  return `${scope}:${String(scopeKey).toLowerCase()}`;
}

// Priority: conversation > type > global > null (default echo-chat-bg)
function resolve(wallpapers, conversationType, conversationId) {
  if (!wallpapers.length || !conversationId) return null;

  const byKey = {};
  for (const w of wallpapers) {
    byKey[normKey(w.scope, w.scope_key)] = w;
  }

  return (
    byKey[normKey('conversation', conversationId)] ||
    (conversationType ? byKey[normKey('type', conversationType)] : null) ||
    byKey[normKey('global', 'global')] ||
    null
  );
}

export const useWallpaperStore = create((set, get) => ({
  wallpapers: [],
  loading: false,
  urlCache: {}, // storage_object_id -> presigned URL

  fetchWallpapers: async () => {
    set({ loading: true });
    try {
      const { data } = await wallpaperApi.getAll();
      set({ wallpapers: data ?? [] });
    } catch {
      // non-fatal: defaults to echo-chat-bg
    } finally {
      set({ loading: false });
    }
  },

  setWallpaper: async (scope, scopeKey, data) => {
    const res = await wallpaperApi.upsert({ scope, scope_key: scopeKey, ...data });
    const entry = res?.data;
    if (!entry) return;
    set((s) => {
      const others = s.wallpapers.filter(
        (w) => !(w.scope === scope && String(w.scope_key).toLowerCase() === String(scopeKey).toLowerCase())
      );
      return { wallpapers: [...others, entry] };
    });
  },

  removeWallpaper: async (scope, scopeKey) => {
    await wallpaperApi.remove(scope, scopeKey);
    set((s) => ({
      wallpapers: s.wallpapers.filter(
        (w) => !(w.scope === scope && w.scope_key === scopeKey)
      ),
    }));
  },

  // Returns the resolved wallpaper entry for a given conversation (or null for default)
  resolveWallpaper: (conversationType, conversationId) => {
    return resolve(get().wallpapers, conversationType, conversationId);
  },

  cacheUrl: (storageObjectId, url) => {
    set((s) => ({ urlCache: { ...s.urlCache, [storageObjectId]: url } }));
  },

  getCachedUrl: (storageObjectId) => {
    return get().urlCache[storageObjectId] ?? null;
  },
}));
