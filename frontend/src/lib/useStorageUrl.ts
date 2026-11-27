import { useEffect, useState } from 'react';
import { storageApi } from '@/lib/endpoints';

// Module-level cache so each attachment URL is only fetched once per session,
// regardless of React StrictMode remounts or the same attachment appearing
// in multiple messages/panels. Values are either a resolved URL string or an
// in-flight Promise, so concurrent mounts share the same request. Shared by
// ConversationPage (message attachments, stickers) and ConversationDetailPanel
// (media/files tabs), so a single cache avoids duplicate signed-URL requests.
export const attachmentUrlCache = new Map<string, string | Promise<string | undefined>>();

/** `thumbnail` pide la miniatura (o el original si la imagen no tiene). */
export type StorageUrlVariant = 'thumbnail';

function cacheKey(objectId: string, variant?: StorageUrlVariant) {
  return variant ? `${objectId}:${variant}` : objectId;
}

/** Resuelve (y cachea) la URL firmada de un storage object. */
export function resolveStorageUrl(objectId: string, variant?: StorageUrlVariant): Promise<string | undefined> {
  const key = cacheKey(objectId, variant);
  const cached = attachmentUrlCache.get(key);
  if (typeof cached === 'string') return Promise.resolve(cached);
  if (cached instanceof Promise) return cached;
  const p = storageApi.getUrl(objectId, variant)
    .then((res) => { attachmentUrlCache.set(key, res.data.url); return res.data.url; })
    .catch(() => { attachmentUrlCache.delete(key); return undefined; });
  attachmentUrlCache.set(key, p);
  return p;
}

// Resolve (and cache) a presigned URL for a storage object id.
export function useStorageUrl(objectId: string | null, variant?: StorageUrlVariant) {
  const [url, setUrl] = useState<string | null>(() => {
    const c = objectId ? attachmentUrlCache.get(cacheKey(objectId, variant)) : null;
    return typeof c === 'string' ? c : null;
  });
  useEffect(() => {
    if (!objectId) return;
    resolveStorageUrl(objectId, variant).then((u) => { if (u) setUrl(u); }).catch(() => {});
  }, [objectId, variant]);
  return url;
}
