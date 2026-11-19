import { useState, useEffect, type CSSProperties } from 'react';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { PRESETS } from '@/components/WallpaperPicker';
import { storageApi } from '@/lib/endpoints';
import type { ConversationResponse } from '@/types/conversation';

/**
 * Estilo de fondo del chat según el wallpaper activo (preset, color o imagen).
 * `null` = fondo por defecto (echo-chat-bg).
 */
export default function useConversationWallpaper(
  conversationId: string | undefined,
  convType: ConversationResponse['type'] | undefined,
) {
  const [wallpaperStyle, setWallpaperStyle] = useState<CSSProperties | null>(null);
  const wallpapers = useWallpaperStore((s) => s.wallpapers);
  const resolveWallpaper = useWallpaperStore((s) => s.resolveWallpaper);
  const cacheUrl = useWallpaperStore((s) => s.cacheUrl);
  const getCachedUrl = useWallpaperStore((s) => s.getCachedUrl);

  // Resolve and apply wallpaper using URL conversationId (works before chat list loads)
  useEffect(() => {
    if (!conversationId) {
      setWallpaperStyle(null);
      return undefined;
    }

    const active = resolveWallpaper(convType, conversationId);
    if (!active) {
      setWallpaperStyle(null);
      return undefined;
    }

    let cancelled = false;

    if (active.wallpaper_type === 'preset') {
      const preset = PRESETS.find((p) => p.key === active.wallpaper_value);
      setWallpaperStyle(preset ? { background: preset.background } : null);
    } else if (active.wallpaper_type === 'color') {
      setWallpaperStyle({ backgroundColor: active.wallpaper_value ?? undefined });
    } else if (active.wallpaper_type === 'image' && active.storage_object_id) {
      const storageObjectId = active.storage_object_id;
      const cached = getCachedUrl(storageObjectId);
      if (cached) {
        setWallpaperStyle({
          backgroundImage: `url(${cached})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        });
      } else {
        storageApi.getUrl(storageObjectId).then((res) => {
          if (cancelled) return;
          const url = res.data?.url;
          if (url) {
            cacheUrl(storageObjectId, url);
            setWallpaperStyle({
              backgroundImage: `url(${url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            });
          }
        }).catch(() => {});
      }
    }

    return () => { cancelled = true; };
  }, [conversationId, convType, wallpapers, resolveWallpaper, getCachedUrl, cacheUrl]);

  return wallpaperStyle;
}
