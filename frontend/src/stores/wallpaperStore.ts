import { create } from 'zustand';
import { wallpaperApi } from '@/lib/endpoints';
import type { UpsertWallpaperRequest, WallpaperEntry } from '@/types/wallpaper';

function normKey(scope: string, scopeKey: string): string {
  return `${scope}:${String(scopeKey).toLowerCase()}`;
}

// Priority: conversation > type > global > null (default echo-chat-bg)
function resolve(
  wallpapers: WallpaperEntry[],
  conversationType: string | null | undefined,
  conversationId: string | null | undefined,
): WallpaperEntry | null {
  if (!wallpapers.length || !conversationId) return null;

  const byKey: Record<string, WallpaperEntry> = {};
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

interface WallpaperState {
  wallpapers: WallpaperEntry[];
  loading: boolean;
  /** storage_object_id -> presigned URL */
  urlCache: Record<string, string>;

  fetchWallpapers: () => Promise<void>;
  setWallpaper: (scope: string, scopeKey: string, data: Omit<UpsertWallpaperRequest, 'scope' | 'scope_key'>) => Promise<void>;
  removeWallpaper: (scope: string, scopeKey: string) => Promise<void>;
  resolveWallpaper: (conversationType: string | null | undefined, conversationId: string | null | undefined) => WallpaperEntry | null;
  cacheUrl: (storageObjectId: string, url: string) => void;
  getCachedUrl: (storageObjectId: string) => string | null;
}

export const useWallpaperStore = create<WallpaperState>()((set, get) => ({
  wallpapers: [],
  loading: false,
  urlCache: {},

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
    const res = await wallpaperApi.upsert({ scope, scope_key: scopeKey, ...data } as UpsertWallpaperRequest);
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
