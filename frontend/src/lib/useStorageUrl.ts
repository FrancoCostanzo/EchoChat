import { useEffect, useState } from 'react';
import { storageApi } from '@/lib/endpoints';

// Module-level cache so each attachment URL is only fetched once per session,
// regardless of React StrictMode remounts or the same attachment appearing
// in multiple messages/panels. Values are either a resolved URL string or an
// in-flight Promise, so concurrent mounts share the same request. Shared by
// ConversationPage (message attachments, stickers) and ConversationDetailPanel
// (media/files tabs), so a single cache avoids duplicate signed-URL requests.
export const attachmentUrlCache = new Map<string, string | Promise<string | undefined>>();

// Resolve (and cache) a presigned URL for a storage object id.
export function useStorageUrl(objectId: string | null) {
  const [url, setUrl] = useState<string | null>(() => {
    const c = objectId ? attachmentUrlCache.get(objectId) : null;
    return typeof c === 'string' ? c : null;
  });
  useEffect(() => {
    if (!objectId) return;
    const cached = attachmentUrlCache.get(objectId);
    if (typeof cached === 'string') { setUrl(cached); return; }
    const promise = cached instanceof Promise
      ? cached
      : (() => {
          const p = storageApi.getUrl(objectId)
            .then((res) => { attachmentUrlCache.set(objectId, res.data.url); return res.data.url; })
            .catch(() => { attachmentUrlCache.delete(objectId); return undefined; });
          attachmentUrlCache.set(objectId, p);
          return p;
        })();
    promise.then((u) => { if (u) setUrl(u); }).catch(() => {});
  }, [objectId]);
  return url;
}
