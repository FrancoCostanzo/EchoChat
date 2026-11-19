import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button, Tooltip } from '@heroui/react';
import { Paperclip, Download, Loader, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ImageViewer from '@/components/ImageViewer';
import VideoViewer from '@/components/VideoViewer';
import PdfPreview from '@/components/PdfPreview';
import { downloadFile } from '@/lib/download';
import { storageApi } from '@/lib/endpoints';
import { useStorageUrl, attachmentUrlCache } from '@/lib/useStorageUrl';
import { EASE_OUT } from '@/lib/motion';
import type { MessageAttachment } from '@/types/message';
import type { MessageSticker } from '@/components/conversation/shared';

/* ─────────────────────────── Sticker / GIF ─────────────────────────── */
// Bare artwork with no bubble chrome. Custom stickers resolve a signed URL
// from their storage object_id; Giphy GIFs use the external CDN url directly.
export function StickerImage({
  sticker,
  sending,
  error,
}: {
  sticker: MessageSticker;
  sending?: boolean;
  error?: boolean;
}) {
  const objectId = sticker.source === 'custom' ? sticker.object_id ?? null : null;
  const resolved = useStorageUrl(objectId);
  const src = objectId ? resolved : sticker.url;
  const isGif = sticker.kind === 'gif';

  return (
    <div
      className={[
        'overflow-hidden',
        isGif ? 'rounded-xl' : '',
        sending ? 'opacity-70' : '',
        error ? 'opacity-50 grayscale' : '',
      ].filter(Boolean).join(' ')}
      style={{
        width: isGif ? 'min(240px, 60vw)' : 'min(160px, 44vw)',
        aspectRatio: sticker.width && sticker.height ? `${sticker.width} / ${sticker.height}` : '1 / 1',
      }}
    >
      {src ? (
        <img
          src={src}
          alt={sticker.alt || (isGif ? 'GIF' : 'Sticker')}
          loading="lazy"
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Loader size={18} className="animate-spin text-ink-200" />
        </div>
      )}
    </div>
  );
}

export default function AttachmentView({ attachment }: { attachment: MessageAttachment }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [url, setUrl] = useState<string | null>(() => {
    const c = attachmentUrlCache.get(attachment.id);
    return typeof c === 'string' ? c : null;
  });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [videoViewerOpen, setVideoViewerOpen] = useState(false);
  const imageLayoutId = `att-img-${attachment.id}`;
  const videoLayoutId = `att-vid-${attachment.id}`;
  const isImage =
    attachment.object_type === 'image' || attachment.mime_type?.startsWith('image/');
  const isVideo =
    attachment.object_type === 'video' || attachment.mime_type?.startsWith('video/');
  const isPdf = attachment.mime_type === 'application/pdf';

  useEffect(() => {
    const cached = attachmentUrlCache.get(attachment.id);
    if (typeof cached === 'string') {
      setUrl(cached);
      return;
    }
    // Reuse in-flight promise or start a new one
    const promise = cached instanceof Promise
      ? cached
      : (() => {
          const p = storageApi.getUrl(attachment.id).then((res) => {
            attachmentUrlCache.set(attachment.id, res.data.url);
            return res.data.url;
          }).catch(() => {
            attachmentUrlCache.delete(attachment.id);
            return undefined;
          });
          attachmentUrlCache.set(attachment.id, p);
          return p;
        })();
    promise.then((resolvedUrl) => { if (resolvedUrl) setUrl(resolvedUrl); }).catch(() => {});
  }, [attachment.id]);

  if (!url) {
    return (
      <div
        className={`echo-shimmer rounded-lg ${
          isImage || isVideo || isPdf ? 'h-48 w-[280px]' : 'h-9 w-44'
        }`}
      />
    );
  }

  if (isImage) {
    return (
      <>
        <motion.div
          className="group relative inline-block min-h-48 cursor-zoom-in overflow-hidden rounded-lg"
          onClick={() => setViewerOpen(true)}
          whileHover={reducedMotion ? undefined : { scale: 1.015 }}
          whileTap={reducedMotion ? undefined : { scale: 0.985 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {!imgLoaded && (
            <div className="echo-shimmer absolute inset-0 z-0 min-h-48 w-[min(400px,70vw)]" />
          )}
          <motion.img
            layoutId={imageLayoutId}
            src={url}
            alt={attachment.original_filename ?? ''}
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: imgLoaded ? 1 : 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="relative z-10 block max-h-80 max-w-[min(400px,70vw)] object-cover"
          />
          <div className="absolute inset-0 z-20 flex items-end justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Tooltip delay={0}>
              <Button
                isIconOnly
                variant="ghost"
                onPress={() => void downloadFile(url, attachment.original_filename)}
                className="h-auto w-auto min-w-0 rounded-md bg-black/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/90"
              >
                <Download size={13} />
              </Button>
              <Tooltip.Content>{t('common.download')}</Tooltip.Content>
            </Tooltip>
          </div>
        </motion.div>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {viewerOpen && (
              <ImageViewer
                key={attachment.id}
                src={url}
                filename={attachment.original_filename ?? undefined}
                layoutId={imageLayoutId}
                onClose={() => setViewerOpen(false)}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
      </>
    );
  }

  if (isVideo) {
    return (
      <>
        <motion.div
          className="group relative inline-block min-h-48 cursor-pointer overflow-hidden rounded-lg bg-black"
          onClick={() => setVideoViewerOpen(true)}
          whileHover={reducedMotion ? undefined : { scale: 1.015 }}
          whileTap={reducedMotion ? undefined : { scale: 0.985 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {!videoReady && (
            <div className="echo-shimmer absolute inset-0 z-0 min-h-48 w-[min(400px,70vw)]" />
          )}
          <motion.video
            layoutId={videoLayoutId}
            src={url}
            preload="metadata"
            muted
            playsInline
            onLoadedData={() => setVideoReady(true)}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: videoReady ? 1 : 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="relative z-10 block max-h-80 max-w-[min(400px,70vw)] rounded-lg object-cover"
          />
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
              <Play size={22} className="ml-0.5" fill="currentColor" />
            </span>
          </div>
          <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-end gap-1 p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <Tooltip delay={0}>
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={() => void downloadFile(url, attachment.original_filename)}
                  className="h-auto w-auto min-w-0 rounded-md bg-black/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/90"
                >
                  <Download size={13} />
                </Button>
                <Tooltip.Content>{t('common.download')}</Tooltip.Content>
              </Tooltip>
            </span>
          </div>
        </motion.div>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {videoViewerOpen && (
              <VideoViewer
                key={attachment.id}
                src={url}
                filename={attachment.original_filename ?? undefined}
                layoutId={videoLayoutId}
                onClose={() => setVideoViewerOpen(false)}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
      </>
    );
  }

  if (isPdf) {
    return (
      <PdfPreview
        url={url}
        filename={attachment.original_filename ?? undefined}
        onDownload={() => void downloadFile(url, attachment.original_filename)}
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border border-ink-400/40 bg-ink-800 px-3 py-2 text-[13px] transition-colors hover:border-ink-300 hover:bg-ink-750"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/15">
        <Paperclip size={14} className="echo-accent-fg" />
      </div>
      <span className="max-w-48 truncate font-medium text-ink-0">{attachment.original_filename}</span>
      <Download size={12} className="ml-auto shrink-0 text-ink-200" />
    </a>
  );
}
