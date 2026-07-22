import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertDialog, Button, Input, Dropdown, Label, Spinner, Tooltip, Modal, toast } from '@heroui/react';
import {
  Paperclip,
  MoreVertical,
  Search,
  Pin,
  PinOff,
  AtSign,
  Smile,
  Reply,
  Forward,
  Bookmark,
  BookmarkCheck,
  Pencil,
  Copy,
  Trash2,
  Hash,
  Users,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CornerUpLeft,
  Download,
  Check,
  CheckCheck,
  X,
  Loader,
  AlertCircle,
  RefreshCw,
  Image,
  Film,
  FileText,
  Send,
  BarChart3,
  Code2,
  Upload,
  MessageSquareText,
  Play,
  ImageIcon,
  Info,
  Phone,
  PhoneMissed,
  Video as VideoIcon,
  Sticker,
  Megaphone,
  UserPlus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore } from '@/stores/callStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import ImageViewer from '@/components/ImageViewer';
import VideoViewer from '@/components/VideoViewer';
import PdfPreview from '@/components/PdfPreview';
import SendButton from '@/components/SendButton';
import MessageSearchPanel from '@/components/MessageSearchPanel';
import PinnedMessagesPanel from '@/components/PinnedMessagesPanel';
import CallHistoryPanel from '@/components/CallHistoryPanel';
import ThreadPanel from '@/components/ThreadPanel';
import PollMessage from '@/components/PollMessage';
import CodeMessage from '@/components/CodeMessage';
import GameMessage from '@/components/GameMessage';
import GamePickerMenu from '@/components/GamePickerMenu';
import MessageInfoModal from '@/components/MessageInfoModal';
import CreatePollModal from '@/components/CreatePollModal';
import CreateCodeModal from '@/components/CreateCodeModal';
import WallpaperPicker from '@/components/WallpaperPicker';
import { PRESETS } from '@/components/WallpaperPicker';
import { formatMessageTime, formatFullTime, formatDaySeparator } from '@/lib/dates';
import FloatingComposer from '@/components/FloatingComposer';
import MessageBody from '@/components/MessageBody';
import { handleFormatShortcut } from '@/components/FormatToolbar';
import DynamicMessageInput from '@/components/DynamicMessageInput';
import StickerGifPicker from '@/components/StickerGifPicker';
import EmojiPicker from '@/components/EmojiPicker';
import { detectBodyFormat } from '@/lib/markdown';
import { parseCodeFence } from '@/lib/codeLanguages';
import {
  MESSAGE_DELETE_WINDOW_MS,
  MESSAGE_EDIT_WINDOW_MS,
  isWithinMessageWindow,
} from '@/lib/messageWindow';
import PresenceAvatarStack from '@/components/PresenceAvatarStack';
import { storageApi, stickerApi, messagesApi, conversationsApi, relationshipsApi } from '@/lib/endpoints';
import { EASE_OUT, SPRING_BOUNCY, msgEntryInitial, msgEntryTransition } from '@/lib/motion';
import { userColor } from '@/lib/userColor';

function downloadBlob(url, filename) {
  fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'file';
      a.click();
      URL.revokeObjectURL(blobUrl);
    })
    .catch(() => window.open(url, '_blank'));
}

const SPRING_OUT = [0.34, 1.56, 0.64, 1];

/* ─────────────────────────── File Picker Menu ─────────────────────────── */
function FilePickerMenu({ onPick, onPoll, onCode, disabled, uploading, open, onOpenChange }) {
  const { t } = useTranslation();
  const setOpen = useCallback((next) => {
    onOpenChange(typeof next === 'function' ? next(open) : next);
  }, [open, onOpenChange]);
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const docRef   = useRef(null);

  const pick = (ref) => { setOpen(false); ref.current?.click(); };

  const FILE_ITEMS = [
    { icon: Image,    label: t('chat.attachImage'),    ref: imageRef, accept: 'image/*' },
    { icon: Film,     label: t('chat.attachVideo'),    ref: videoRef, accept: 'video/*' },
    { icon: FileText, label: t('chat.attachDocument'), ref: docRef,   accept: '*/*' },
  ];

  const MENU_ITEMS = [
    ...FILE_ITEMS,
    ...(onCode ? [{ icon: Code2, label: t('code.sendTitle'), action: onCode }] : []),
    ...(onPoll ? [{ icon: BarChart3, label: t('poll.create'), action: onPoll }] : []),
  ];

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? MENU_ITEMS.length * 40;
    const menuWidth = menu?.offsetWidth ?? 192;
    const gap = 8;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Prefer opening above the attach button (composer sits at the bottom on mobile)
    let top = rect.top - menuHeight - gap;
    if (top < gap) {
      top = rect.bottom + gap;
      if (top + menuHeight > vh - gap) {
        top = Math.max(gap, vh - menuHeight - gap);
      }
    }

    let left = rect.left;
    if (left + menuWidth > vw - gap) left = vw - menuWidth - gap;
    if (left < gap) left = gap;

    setMenuPos({ left, top });
  }, [MENU_ITEMS.length]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, [setOpen]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    requestAnimationFrame(updateMenuPosition);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const target = e.target;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler, { passive: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // The portal must stay mounted while AnimatePresence runs the exit animation;
  // the `open` conditional lives inside it so closing doesn't unmount abruptly.
  const menu = createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: menuPos ? 1 : 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: menuPos?.left ?? -9999,
            top: menuPos?.top ?? -9999,
            visibility: menuPos ? 'visible' : 'hidden',
            zIndex: 9999,
          }}
          className="min-w-48 overflow-hidden rounded-lg border border-ink-400/40 bg-ink-850 shadow-xl"
        >
          {MENU_ITEMS.map(({ icon: Icon, label, ref, action }) => (
            <Button
              key={label}
              variant="ghost"
              onPress={() => {
                setOpen(false);
                if (action) action();
                else pick(ref);
              }}
              className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-3 py-2 text-[14px] text-ink-50 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </Button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  return (
    <div className="relative shrink-0" ref={rootRef}>
      {FILE_ITEMS.map(({ ref, accept }) => (
        <input
          key={accept}
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onPick(f); e.target.value = ''; } }}
        />
      ))}

      <div ref={triggerRef} className="shrink-0">
        <Button
          isIconOnly
          variant="ghost"
          isDisabled={disabled}
          onPress={toggleOpen}
          aria-label={t('chat.attachFile')}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex h-9 w-9 min-w-0 shrink-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          {uploading ? <Loader size={18} className="animate-spin" /> : <Paperclip size={18} />}
        </Button>
      </div>

      {menu}
    </div>
  );
}

/* Emoji picker now lives in components/EmojiPicker.jsx (emoji-mart library). */

/* ─────────────────────────── File Preview Bar ─────────────────────────── */
function FilePreviewBar({ file, onSend, onCancel }) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [objectUrl, setObjectUrl] = useState(null);
  const isImage = file?.type.startsWith('image/');
  const isVideo = file?.type.startsWith('video/');

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => { URL.revokeObjectURL(url); setObjectUrl(null); };
  }, [file]);

  const handleSend = async () => {
    setSending(true);
    try { await onSend(file, caption.trim()); }
    finally { setSending(false); }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: SPRING_OUT }}
      className="mx-3 overflow-hidden rounded-t-lg border-b border-ink-900 bg-ink-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/20 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {isImage
            ? <Image size={14} className="shrink-0 text-accent" />
            : isVideo
              ? <Film size={14} className="shrink-0 text-accent" />
              : <FileText size={14} className="shrink-0 text-accent" />}
          <span className="truncate text-[13px] font-semibold">{file.name}</span>
          <span className="shrink-0 text-[11px] text-ink-200">{formatSize(file.size)}</span>
        </div>
        <Button
          isIconOnly
          variant="ghost"
          onPress={onCancel}
          isDisabled={sending}
          className="ml-2 h-auto w-auto min-w-0 shrink-0 rounded-md p-1 text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          <X size={15} />
        </Button>
      </div>

      {/* Preview area */}
      <div className="flex max-h-60 items-center justify-center overflow-hidden bg-ink-900/50 px-4 py-3">
        {isImage && (
            <img src={objectUrl} alt={file.name} className="max-h-52 max-w-full rounded-lg object-contain shadow-md" />
          )}
          {isVideo && (
            <video src={objectUrl} controls className="max-h-52 max-w-full rounded-lg shadow-md" />
          )}
          {!isImage && !isVideo && (
            <div className="flex items-center gap-4 py-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                <FileText size={28} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="max-w-xs truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-ink-200">{formatSize(file.size)}</p>
              </div>
            </div>
          )}
      </div>

      {/* Caption + send */}
      <div className="flex items-end gap-2 px-3 py-2.5">
          <Input
            autoFocus
            placeholder={t('chat.captionPlaceholder')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              if (e.key === 'Escape') onCancel();
            }}
            disabled={sending}
            className="flex-1 border-ink-400/40 bg-ink-750"
          />
          <Button
            isIconOnly
            isDisabled={sending}
            className="shrink-0 rounded-md bg-accent text-accent-foreground transition-[filter] hover:brightness-110"
            onPress={handleSend}
          >
            {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-0.5 text-ink-100">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 1.2,
            ease: 'easeInOut',
            repeat: Number.POSITIVE_INFINITY,
            delay: index * 0.15,
          }}
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      ))}
    </div>
  );
}

/* ─────────────────────────── Confirm Delete Modal ─────────────────────────── */
function ConfirmDeleteModal({ message, isOpen, onConfirm, onCancel }) {
  const { t } = useTranslation();

  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onCancel(); }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[400px]">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{t('chat.deleteMessage')}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <p className="text-pretty text-ink-100">
              {t('chat.deleteMessageWarning')}
            </p>
            {message?.body && message.type !== 'media' && (
              <div className="rounded-xl border border-ink-700/60 bg-ink-800/70 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-100 line-clamp-3">
                {message.body}
              </div>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onPress={onConfirm} autoFocus>
              <Trash2 size={14} />
              {t('common.delete')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

/* ─────────────────────────── Attachment View ─────────────────────────── */
// Module-level cache so each attachment URL is only fetched once per session,
// regardless of React StrictMode remounts or the same attachment appearing
// in multiple messages.  Values are either a resolved URL string or an
// in-flight Promise, so concurrent mounts share the same request.
const _attachmentUrlCache = new Map();

// Resolve (and cache) a presigned URL for a storage object id. Shared by
// attachments and custom stickers.
function useStorageUrl(objectId) {
  const [url, setUrl] = useState(() => {
    const c = objectId ? _attachmentUrlCache.get(objectId) : null;
    return typeof c === 'string' ? c : null;
  });
  useEffect(() => {
    if (!objectId) return;
    const cached = _attachmentUrlCache.get(objectId);
    if (typeof cached === 'string') { setUrl(cached); return; }
    const promise = cached instanceof Promise
      ? cached
      : (() => {
          const p = storageApi.getUrl(objectId)
            .then((res) => { _attachmentUrlCache.set(objectId, res.data.url); return res.data.url; })
            .catch(() => { _attachmentUrlCache.delete(objectId); });
          _attachmentUrlCache.set(objectId, p);
          return p;
        })();
    promise.then((u) => { if (u) setUrl(u); }).catch(() => {});
  }, [objectId]);
  return url;
}

/* ─────────────────────────── Sticker / GIF ─────────────────────────── */
// Bare artwork with no bubble chrome. Custom stickers resolve a signed URL
// from their storage object_id; Giphy GIFs use the external CDN url directly.
function StickerImage({ sticker, sending, error }) {
  const objectId = sticker.source === 'custom' ? sticker.object_id : null;
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

function AttachmentView({ attachment }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [url, setUrl] = useState(() => _attachmentUrlCache.get(attachment.id) ?? null);
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
    const cached = _attachmentUrlCache.get(attachment.id);
    if (typeof cached === 'string') {
      setUrl(cached);
      return;
    }
    // Reuse in-flight promise or start a new one
    const promise = cached instanceof Promise
      ? cached
      : (() => {
          const p = storageApi.getUrl(attachment.id).then((res) => {
            _attachmentUrlCache.set(attachment.id, res.data.url);
            return res.data.url;
          }).catch(() => {
            _attachmentUrlCache.delete(attachment.id);
          });
          _attachmentUrlCache.set(attachment.id, p);
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
            alt={attachment.original_filename}
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: imgLoaded ? 1 : 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="relative z-10 block max-h-80 max-w-[min(400px,70vw)] object-cover"
          />
          <div className="absolute inset-0 z-20 flex items-end justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Button
              isIconOnly
              variant="ghost"
              onPress={() => downloadBlob(url, attachment.original_filename)}
              className="h-auto w-auto min-w-0 rounded-md bg-black/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/90"
              title={t('common.download')}
            >
              <Download size={13} />
            </Button>
          </div>
        </motion.div>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {viewerOpen && (
              <ImageViewer
                key={attachment.id}
                src={url}
                filename={attachment.original_filename}
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
              <Button
                isIconOnly
                variant="ghost"
                onPress={() => downloadBlob(url, attachment.original_filename)}
                className="h-auto w-auto min-w-0 rounded-md bg-black/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/90"
                title={t('common.download')}
              >
                <Download size={13} />
              </Button>
            </span>
          </div>
        </motion.div>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {videoViewerOpen && (
              <VideoViewer
                key={attachment.id}
                src={url}
                filename={attachment.original_filename}
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
        filename={attachment.original_filename}
        onDownload={() => downloadBlob(url, attachment.original_filename)}
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
        <Paperclip size={14} className="text-accent" />
      </div>
      <span className="max-w-48 truncate font-medium text-ink-0">{attachment.original_filename}</span>
      <Download size={12} className="ml-auto shrink-0 text-ink-200" />
    </a>
  );
}

/* ─────────────────────────── Message Row (Discord cozy) ─────────────────────────── */
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function ReactionPill({ emoji, count, mine, onClick }) {
  return (
    <Button
      variant="ghost"
      onPress={onClick}
      className={[
        'echo-press flex h-auto min-w-0 items-center justify-start gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold leading-none',
        mine
          ? 'echo-glow-sm border-accent/60 bg-accent/20 text-accent'
          : 'border-ink-400/40 bg-ink-800/70 text-ink-50 hover:border-accent/50 hover:bg-ink-750',
      ].join(' ')}
    >
      <span className="text-[14px]">{emoji}</span>
      <span>{count}</span>
    </Button>
  );
}

// Delivery receipt — only rendered on the user's own (accent) bubbles.
function ReceiptIcon({ message }) {
  const reducedMotion = useReducedMotion();
  const key = message._status === 'sending'
    ? 'sending'
    : message._status === 'error'
      ? 'error'
      : message.read_count > 0
        ? 'read'
        : message.delivered_count > 0
          ? 'delivered'
          : 'sent';

  const icon = (() => {
    if (message._status === 'sending') return <Loader size={13} className="animate-spin text-white/70" />;
    if (message._status === 'error') return <AlertCircle size={13} className="text-red-200" />;
    if (message.read_count > 0) return <CheckCheck size={13} className="text-sky-300" />;
    if (message.delivered_count > 0) return <CheckCheck size={13} className="text-white/70" />;
    return <Check size={13} className="text-white/70" />;
  })();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={key}
        className="inline-flex"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.5, y: 2 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, scale: 0.6 }}
        transition={reducedMotion ? { duration: 0.01 } : SPRING_BOUNCY}
      >
        {icon}
      </motion.span>
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────
   MessageContextMenu — right-click / long-press action menu.
   Rendered in a portal, positioned at the cursor and clamped
   to the viewport. Closes on outside-click, Escape, scroll/resize.
   ───────────────────────────────────────────────────────── */
function MessageContextMenu({ pos, onClose, quickEmojis, onEmoji, items }) {
  const ref = useRef(null);
  const [coords, setCoords] = useState({ left: pos.x, top: pos.y, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    let left = pos.x;
    let top = pos.y;
    if (left + width + pad > window.innerWidth) left = window.innerWidth - width - pad;
    if (top + height + pad > window.innerHeight) top = Math.max(pad, pos.y - height);
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    setCoords({ left, top, ready: true });
  }, [pos]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onPointerDown = (e) => {
      if (ref.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-0 z-80" aria-hidden />
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: coords.ready ? 1 : 0, scale: coords.ready ? 1 : 0.92, y: coords.ready ? 0 : 6 }}
        exit={{ opacity: 0, scale: 0.95, y: 4, transition: { duration: 0.12, ease: 'easeIn' } }}
        transition={SPRING_BOUNCY}
        style={{ left: coords.left, top: coords.top, transformOrigin: 'top left' }}
        className="echo-glass-strong pointer-events-auto fixed z-80 w-56 overflow-hidden rounded-2xl p-1.5"
      >
        {/* Quick reactions */}
        <div className="mb-1 flex items-center justify-between gap-0.5 px-1.5 pb-1.5">
          {quickEmojis.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => onEmoji(em)}
              className="echo-press flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-white/10"
            >
              {em}
            </button>
          ))}
        </div>
        <div className="mb-1 h-px bg-white/10" />
        {/* Actions */}
        {items.map((it) =>
          it ? (
            <button
              key={it.key}
              type="button"
              onClick={it.onClick}
              className={[
                'echo-press flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                it.danger
                  ? 'text-echo-dnd hover:bg-echo-dnd/15'
                  : 'text-ink-50 hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
            >
              <it.icon size={16} className="shrink-0" />
              <span className="truncate">{it.label}</span>
            </button>
          ) : null
        )}
      </motion.div>
    </>,
    document.body
  );
}

function buildMessageMenuItems({
  message, isOwn, saved, pinned, t, closeMenu,
  onReply, onOpenThread, onForward, onEdit, onDelete, onToggleSave, onTogglePin, onInfo, onSaveSticker,
}) {
  const withinEditWindow = isWithinMessageWindow(message.sent_at, MESSAGE_EDIT_WINDOW_MS);
  const withinDeleteWindow = isWithinMessageWindow(message.sent_at, MESSAGE_DELETE_WINDOW_MS);
  const canEdit = isOwn
    && withinEditWindow
    && !message.is_deleted
    && (message.type !== 'media' || message.body);
  const canDelete = isOwn && withinDeleteWindow && !message.is_deleted;
  const canCopy = !!message.body;
  // Only custom stickers can be saved — Giphy GIFs are external URLs, not storage objects.
  const canSaveSticker = message.type === 'sticker'
    && message.metadata?.sticker?.source === 'custom'
    && !!message.metadata?.sticker?.object_id;
  return [
    { key: 'reply', icon: Reply, label: t('chat.reply'), onClick: () => { closeMenu(); onReply(message); } },
    !message.thread_id && { key: 'thread', icon: MessageSquareText, label: t('chat.replyInThread'), onClick: () => { closeMenu(); onOpenThread(message); } },
    { key: 'forward', icon: Forward, label: t('chat.forward'), onClick: () => { closeMenu(); onForward(message); } },
    canSaveSticker && { key: 'saveSticker', icon: Sticker, label: t('sticker.saveToCollection'), onClick: () => { closeMenu(); onSaveSticker(message); } },
    canCopy && { key: 'copy', icon: Copy, label: t('chat.copyText'), onClick: () => { closeMenu(); navigator.clipboard?.writeText(message.body); } },
    { key: 'pin', icon: pinned ? PinOff : Pin, label: pinned ? t('chat.unpin') : t('chat.pin'), onClick: () => { closeMenu(); onTogglePin(message); } },
    { key: 'save', icon: saved ? BookmarkCheck : Bookmark, label: saved ? t('saved.remove') : t('chat.save'), onClick: () => { closeMenu(); onToggleSave(message); } },
    isOwn && { key: 'info', icon: Info, label: t('chat.messageInfo'), onClick: () => { closeMenu(); onInfo(message); } },
    canEdit && { key: 'edit', icon: Pencil, label: t('common.edit'), onClick: () => { closeMenu(); onEdit(message); } },
    canDelete && { key: 'delete', icon: Trash2, label: t('common.delete'), danger: true, onClick: () => { closeMenu(); onDelete(message); } },
  ];
}

/* ─────────────────────────────────────────────────────────
   EmptyConversationState — friendly hero for chats with no
   messages yet. One-tap "say hi" sends a wave to break the ice.
   ───────────────────────────────────────────────────────── */
function EmptyConversationState({ conversation, convName, onSayHi, sending }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const isDirect = conversation.type === 'direct';
  const isGroup = conversation.type === 'group';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <div className="relative">
        {isDirect ? (
          <UserAvatar
            user={{ display_name: convName, avatar_url: conversation.other_avatar_url }}
            size="lg"
            className="scale-125"
          />
        ) : (
          <div className="echo-grad-brand echo-glow-md echo-on-accent flex h-20 w-20 items-center justify-center rounded-3xl">
            {isGroup
              ? <Users size={36} strokeWidth={1.8} />
              : <Hash size={36} strokeWidth={1.8} />}
          </div>
        )}
        <motion.span
          aria-hidden
          animate={reducedMotion ? undefined : { rotate: [0, 16, -9, 16, 0] }}
          transition={{ duration: 1.1, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY, repeatDelay: 2.4 }}
          className="absolute -bottom-3 -right-4 origin-[70%_70%] text-3xl drop-shadow-md"
        >
          👋
        </motion.span>
      </div>

      <div>
        <h3 className="echo-display text-2xl font-semibold">{t('chat.noMessagesTitle')}</h3>
        <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-100">
          {isDirect
            ? t('chat.noMessagesDirect', { name: convName })
            : isGroup
              ? t('chat.noMessagesGroup')
              : t('chat.noMessagesChannel', { name: convName })}
        </p>
      </div>

      <button
        type="button"
        onClick={onSayHi}
        disabled={sending}
        className="echo-press echo-grad-brand echo-glow-md echo-on-accent pointer-events-auto flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold disabled:opacity-60"
      >
        {sending
          ? <Loader size={16} className="animate-spin" />
          : <span className="text-lg leading-none">👋</span>}
        {t('chat.sayHi')}
      </button>
    </motion.div>
  );
}

// Centered date chip inserted between messages whenever the calendar day changes.
function DaySeparator({ date }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-ink-800/80 px-3 py-1 text-[11px] font-medium text-ink-100 shadow-sm backdrop-blur-sm">
        {formatDaySeparator(date)}
      </span>
    </div>
  );
}

/* Centered pill summarizing a finished/missed call. Doubles as chat history. */
function CallEventRow({ message, currentUserId, shouldAnimate, reducedMotion, t }) {
  const meta = message.metadata || {};
  const isVideo = meta.call_type === 'video';
  const outgoing = meta.initiated_by === currentUserId;
  const missed = meta.outcome === 'missed';
  const declined = meta.outcome === 'declined';

  let label;
  if (missed) label = outgoing ? t('call.timeline.noAnswer') : t('call.timeline.missed');
  else if (declined) label = outgoing ? t('call.timeline.declined') : t('call.timeline.declinedByYou');
  else label = isVideo ? t('call.timeline.videoCall') : t('call.timeline.voiceCall');

  const secs = meta.duration_seconds || 0;
  const duration = secs > 0
    ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
    : null;

  const Icon = missed ? PhoneMissed : isVideo ? VideoIcon : Phone;
  const danger = missed || declined;

  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={shouldAnimate && !reducedMotion ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-center px-4 py-1.5"
    >
      <div
        className={[
          'flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] shadow-sm backdrop-blur-sm',
          danger
            ? 'border-echo-dnd/30 bg-echo-dnd/10 text-echo-dnd'
            : 'border-white/10 bg-ink-800/70 text-ink-100',
        ].join(' ')}
      >
        <Icon size={13} className="shrink-0" />
        <span className="font-medium">{label}</span>
        {duration && <span className="text-ink-200">· {duration}</span>}
        <span className="text-ink-300">· {formatMessageTime(message.sent_at)}</span>
      </div>
    </motion.div>
  );
}

const MessageRow = memo(function MessageRow({ message, isOwn, isDirect, isFirstInGroup, isLastInGroup, isContextOpen, shouldAnimateEntry, onOpenContextMenu, onScrollToReply, onEdit, onDelete, onReply, onReact, onForward, onOpenThread, onRetry, currentUserId, currentUser }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const saved = !!message.is_saved;
  const longPressTimer = useRef(null);

  const isPending = message._status === 'sending' || message._status === 'error';

  const displayName = isOwn
    ? (currentUser?.display_name || message.sender_display_name || t('common.you'))
    : message.sender_display_name;
  const avatarUrl = isOwn
    ? currentUser?.avatar_url
    : message.sender_avatar_url;

  const showName = !isOwn && !isDirect && isFirstInGroup;
  const showAvatar = !isOwn && !isDirect;

  // ── Context-menu (right-click / long-press) ──
  const actionable = !isPending && !message.is_deleted;
  const openMenuAt = (x, y) => onOpenContextMenu(message.id, { x, y });
  const openMenu = (e) => {
    if (!actionable) return;
    e.preventDefault();
    openMenuAt(e.clientX ?? e.touches?.[0]?.clientX ?? 0, e.clientY ?? e.touches?.[0]?.clientY ?? 0);
  };
  const handleTouchStart = (e) => {
    if (!actionable) return;
    const t0 = e.touches[0];
    const { clientX, clientY } = t0;
    longPressTimer.current = setTimeout(() => openMenuAt(clientX, clientY), 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const sticker = message.type === 'sticker' ? message.metadata?.sticker : null;
  const isSticker = Boolean(sticker);
  const broadcastListName = message.metadata?.broadcast_list_name || null;
  const isBroadcast = Boolean(message.metadata?.broadcast_msg_id || message.metadata?.broadcast_list_id);

  const isMediaOnly =
    message.type === 'media' && message.attachments?.length > 0 && !message.body;

  // WhatsApp-style asymmetric corners: the "tail" corner is squared off on the
  // first bubble of a group, on the side the bubble is anchored to.
  // Stickers/GIFs float bare — no bubble chrome, just the artwork.
  const bubbleClass = isSticker
    ? [
        'relative max-w-full bg-transparent',
        isContextOpen ? 'echo-selected' : '',
      ].join(' ')
    : [
        'relative max-w-full transition-shadow',
        isMediaOnly ? 'overflow-hidden p-1' : 'px-3 py-1.5',
        isOwn
          ? 'echo-grad-own echo-glow-own echo-on-accent'
          : 'bg-ink-800/85 text-ink-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-white/8',
        'rounded-2xl',
        isFirstInGroup ? (isOwn ? 'rounded-tr-md' : 'rounded-tl-md') : '',
        isContextOpen ? 'echo-selected' : '',
      ].join(' ');

  const metaClass = isSticker ? 'text-ink-200' : isOwn ? 'echo-on-accent-muted' : 'text-ink-200';

  const justSent = isOwn && message._status === 'sent';

  // ── Evento de llamada en el timeline (sirve de aviso e historial) ──
  if (message.type === 'system' && message.metadata?.event === 'call') {
    return (
      <CallEventRow
        message={message}
        currentUserId={currentUserId}
        shouldAnimate={shouldAnimateEntry}
        reducedMotion={reducedMotion}
        t={t}
      />
    );
  }

  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={msgEntryInitial(isOwn, shouldAnimateEntry, reducedMotion)}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={msgEntryTransition(isOwn, reducedMotion)}
      onContextMenu={openMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
      className={[
        'echo-msg-row group relative flex gap-2 rounded-lg px-3 transition-colors sm:px-4',
        isFirstInGroup ? 'mt-3' : 'mt-0.5',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        isContextOpen ? 'bg-white/4' : 'hover:bg-white/2.5',
      ].join(' ')}
    >
      {/* Avatar gutter (group chats, other users only) */}
      {showAvatar && (
        <div className="w-8 shrink-0 select-none self-end">
          {isLastInGroup && (
            <UserAvatar user={{ display_name: displayName, avatar_url: avatarUrl }} size="sm" />
          )}
        </div>
      )}

      {/* Bubble column */}
      <div className={[
        'relative flex min-w-0 max-w-[82%] flex-col sm:max-w-[68%]',
        isOwn ? 'items-end' : 'items-start',
      ].join(' ')}>
        <motion.div
          className={bubbleClass}
          animate={
            reducedMotion || !justSent
              ? undefined
              : { scale: [1, 1.018, 1], transition: { duration: 0.35, ease: EASE_OUT } }
          }
        >
          {/* Sender name (group chats, first in group) — deterministic per-user hue */}
          {showName && (
            <p className="mb-0.5 text-[13px] font-semibold" style={{ color: userColor(message.sender_id) }}>
              {displayName}
            </p>
          )}

          {/* Broadcast origin — DM came from a broadcast list fan-out */}
          {isBroadcast && !message.is_deleted && (
            <div
              className={[
                'mb-1 flex max-w-full items-center gap-1 text-[11px] font-medium leading-tight',
                isOwn ? 'text-white/75' : 'text-accent',
              ].join(' ')}
              title={
                broadcastListName
                  ? t('chat.fromBroadcastList', { name: broadcastListName })
                  : t('chat.fromBroadcast')
              }
            >
              <Megaphone size={11} className="shrink-0 opacity-90" aria-hidden />
              <span className="truncate">
                {broadcastListName
                  ? t('chat.fromBroadcastList', { name: broadcastListName })
                  : t('chat.fromBroadcast')}
              </span>
            </div>
          )}

          {/* Reply preview — click to jump to the original message */}
          {message.reply_to_id && (message.reply_to_body || message.reply_to_type) && (
            <button
              type="button"
              title={t('chat.jumpToOriginal')}
              onClick={(e) => {
                e.stopPropagation();
                onScrollToReply(message.reply_to_id);
              }}
              className={[
                'echo-press mb-1 flex w-full flex-col gap-0.5 rounded-md border-l-[3px] px-2 py-1 text-left text-[12px] transition-colors',
                isOwn
                  ? 'border-white/70 bg-black/15 hover:bg-black/25'
                  : 'border-accent bg-black/10 hover:bg-black/20',
              ].join(' ')}
            >
              {message.reply_to_sender && (
                <span className={isOwn ? 'font-semibold text-white/90' : 'font-semibold text-accent'}>
                  {message.reply_to_sender}
                </span>
              )}
              <span className={['truncate', isOwn ? 'text-white/70' : 'text-ink-200'].join(' ')}>
                {message.reply_to_type === 'media'
                  ? <span className="inline-flex items-center gap-1"><Paperclip size={11} />{t('chat.attachedFile')}</span>
                  : message.reply_to_type === 'sticker'
                    ? <span className="inline-flex items-center gap-1"><Sticker size={11} />{t('sticker.previewSticker')}</span>
                    : message.reply_to_body}
              </span>
            </button>
          )}

          {/* Deleted */}
          {message.is_deleted ? (
            <div className={['flex items-center gap-1.5 text-[14px] italic', isOwn ? 'text-white/70' : 'text-ink-200'].join(' ')}>
              <Trash2 size={13} className="shrink-0 opacity-60" />
              <span>{t('chat.messageDeleted')}</span>
            </div>
          ) : (
            <>
              {/* Poll */}
              {message.type === 'poll' && message.poll && (
                <PollMessage message={message} currentUserId={currentUserId} />
              )}

              {/* Code snippet */}
              {message.type === 'code' && message.body && (
                <CodeMessage message={message} variant={isOwn ? 'own' : 'other'} />
              )}

              {/* Mini-game invite/board */}
              {message.type === 'game' && message.game && (
                <GameMessage message={message} currentUserId={currentUserId} variant={isOwn ? 'own' : 'other'} />
              )}

              {/* Sticker / GIF — bare artwork, no bubble */}
              {isSticker && (
                <StickerImage
                  sticker={sticker}
                  sending={message._status === 'sending'}
                  error={message._status === 'error'}
                />
              )}

              {/* Body */}
              {message.type !== 'media' && message.type !== 'poll' && message.type !== 'code' && message.type !== 'sticker' && message.type !== 'game' && message.body && (
                <MessageBody
                  body={message.body}
                  bodyFormat={message.body_format}
                  variant={isOwn ? 'own' : 'other'}
                  className={[
                    message._status === 'sending' ? 'opacity-70' : '',
                    message._status === 'error' ? (isOwn ? 'text-red-100' : 'text-echo-dnd') : '',
                  ].filter(Boolean).join(' ')}
                />
              )}

              {/* Attachments */}
              {message.attachments?.length > 0 && (
                <div className={`flex flex-col items-start gap-2 ${message.body ? 'mt-2' : ''}`}>
                  {message.attachments.map((att) => (
                    <AttachmentView key={att.id} attachment={att} />
                  ))}
                </div>
              )}

              {/* Pending attachment */}
              {message.type === 'media' && (!message.attachments || message.attachments.length === 0) && message._status === 'sending' && (
                <div className="flex items-center gap-2 px-1 py-1 text-xs">
                  <Loader size={13} className={`animate-spin shrink-0 ${isOwn ? 'text-white/80' : 'text-accent'}`} />
                  <span className={`max-w-64 truncate ${isOwn ? 'text-white/80' : 'text-ink-100'}`}>{message._filename || t('chat.uploadingFile')}</span>
                </div>
              )}
            </>
          )}

          {/* Meta line: saved · edited · time · receipt */}
          <div className={['mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none', metaClass, isMediaOnly ? 'px-1 pb-0.5' : ''].join(' ')}>
            {saved && !message.is_deleted && (
              <BookmarkCheck size={10} className="shrink-0 opacity-90" title={t('chat.savedMessage')} />
            )}
            {message.is_edited && !message.is_deleted && <span>{t('chat.edited')}</span>}
            <span title={formatFullTime(message.sent_at)}>{formatMessageTime(message.sent_at)}</span>
            {isOwn && !message.is_deleted && <ReceiptIcon message={message} />}
          </div>
        </motion.div>

        {/* Retry (own, error) */}
        {isOwn && message._status === 'error' && (
          <Button
            variant="ghost"
            onPress={() => onRetry(message.id)}
            className="mt-0.5 flex h-auto w-fit min-w-0 items-center gap-1 self-start bg-transparent p-0 text-[11px] font-normal text-echo-dnd hover:bg-transparent hover:underline"
          >
            <RefreshCw size={10} className="size-3" />
            {t('chat.retrySend')}
          </Button>
        )}

        {/* Thread reply counter — opens the thread panel */}
        {!message.is_deleted && message.thread_count > 0 && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className={[
              'echo-press mt-1 flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[12px] font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent/20',
              isOwn ? 'self-end' : 'self-start',
            ].join(' ')}
          >
            <MessageSquareText size={12} />
            {t('chat.threadReplies', { count: message.thread_count })}
          </button>
        )}

        {/* Reactions */}
        {!message.is_deleted && message.reactions?.length > 0 && (
          <div className={['mt-1 flex flex-wrap gap-1', isOwn ? 'justify-end' : 'justify-start'].join(' ')}>
            {message.reactions.map((r, i) => (
              <ReactionPill
                key={i}
                emoji={r.emoji}
                count={r.count}
                mine={Array.isArray(r.user_ids) && currentUserId && r.user_ids.includes(currentUserId)}
                onClick={() => onReact(message.id, r.emoji)}
              />
            ))}
            <button
              type="button"
              onClick={openMenu}
              className="echo-press flex h-auto items-center rounded-full border border-ink-400/40 bg-ink-800/70 px-1.5 py-0.5 text-ink-200 transition-colors hover:border-accent/55 hover:text-foreground"
              title={t('chat.react')}
            >
              <Smile size={13} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

/* ─────────────────────────────────────────────────────────
   ForwardModal — pick target conversations to forward a message
   ───────────────────────────────────────────────────────── */
function ForwardModal({ message, conversations, currentConvId, isOpen, onClose }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  const handleOpenChange = (open) => {
    if (!open) {
      onClose();
      setSelected([]);
      setSearch('');
    }
  };

  const query = search.trim().toLowerCase();
  const targets = conversations.filter((c) => {
    if (c.id === currentConvId) return false;
    if (!query) return true;
    return (c.display_name || c.name || '').toLowerCase().includes(query);
  });

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleForward = async () => {
    if (selected.length === 0 || !message) return;
    setSending(true);
    try {
      await messagesApi.forward(message.id, selected);
      onClose();
      setSelected([]);
      setSearch('');
    } catch {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <Forward size={16} /> {t('chat.forwardTo')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-200" />
                <Input className="pl-9" placeholder={t('sidebar.searchConversation')} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>

              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                {targets.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-200">{t('sidebar.noConversations')}</p>
                ) : targets.map((c) => {
                  const name = c.display_name || c.name || t('sidebar.noName');
                  const isSel = selected.includes(c.id);
                  return (
                    <Button
                      key={c.id}
                      variant="ghost"
                      onPress={() => toggle(c.id)}
                      className={`flex h-auto w-full items-center justify-start gap-3 rounded-md px-2 py-2 text-left transition-colors ${isSel ? 'bg-accent/15 echo-ring-soft' : 'hover:bg-ink-750'}`}
                    >
                      {c.type === 'direct' ? (
                        <UserAvatar user={{ display_name: name, avatar_url: c.other_avatar_url }} size="sm" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-ink-100"><Hash size={15} /></div>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                      {isSel && <Check size={16} className="text-accent" />}
                    </Button>
                  );
                })}
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button className="w-full" isDisabled={selected.length === 0} isPending={sending} onPress={handleForward}>
                {t('chat.forward')}{selected.length > 0 ? ` (${selected.length})` : ''}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default function ConversationPage() {
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    messages,
    loadingMessages,
    hasMoreMessages,
    setActiveConversation,
    sendMessage,
    retrySendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    loadMoreMessages,
    getActiveConversation,
    typingUsers,
    emitTyping,
    clearActiveConversation,
    conversations,
    patchMessage,
    joinConversation,
    onlineUsers,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // message object to confirm delete
  const [previewFile, setPreviewFile] = useState(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [forwardTarget, setForwardTarget] = useState(null); // message being forwarded
  const [infoTarget, setInfoTarget] = useState(null); // message whose info panel is open
  const [threadRoot, setThreadRoot] = useState(null); // root message of the open thread panel
  const [contextMenu, setContextMenu] = useState(null); // { messageId, x, y } | null
  const [sendPulse, setSendPulse] = useState(false);
  const [sendingHi, setSendingHi] = useState(false);
  const sendPulseTimerRef = useRef(null);
  const [showPollModal, setShowPollModal] = useState(false);
  // Which composer flyout is open — at most one at a time (attach menu, sticker/GIF, emoji).
  const [activePicker, setActivePicker] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeModalInitial, setCodeModalInitial] = useState({ body: '', language: 'plaintext' });
  const [isDragging, setIsDragging] = useState(false);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const dragCounterRef = useRef(0);

  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const [wallpaperStyle, setWallpaperStyle] = useState(null); // null = default echo-chat-bg
  const [isContact, setIsContact] = useState(null); // null = unknown, true/false once loaded
  const [addingContact, setAddingContact] = useState(false);

  const wallpapers = useWallpaperStore((s) => s.wallpapers);
  const resolveWallpaper = useWallpaperStore((s) => s.resolveWallpaper);
  const cacheUrl = useWallpaperStore((s) => s.cacheUrl);
  const getCachedUrl = useWallpaperStore((s) => s.getCachedUrl);

  const messagesEndRef = useRef(null);
  const messagesContentRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevScrollHeightRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const wasAtBottomRef = useRef(true);
  const initialLoadRef = useRef(false); // true after first batch of messages is rendered
  const anchorBottomRef = useRef(false); // keep pinned while media loads on open
  const anchorTimerRef = useRef(null);
  const prevScrollTopRef = useRef(0);
  const prevContentHeightRef = useRef(0);
  const scrollIdleTimerRef = useRef(null);
  const draftReadyRef = useRef(false);  // true once the draft for this conv has loaded
  const draftSaveTimerRef = useRef(null);

  const conversation =
    conversations.find((c) => c.id === conversationId) ?? getActiveConversation();
  const isDirect = conversation?.type === 'direct';
  const otherUserId = isDirect ? (conversation?.other_user_id || conversation?.member_user_id) : null;

  // Check whether the DM peer is already in contacts (only for direct chats).
  useEffect(() => {
    if (!otherUserId) {
      setIsContact(null);
      return undefined;
    }
    let alive = true;
    setIsContact(null);
    relationshipsApi.getContacts()
      .then(({ data }) => {
        if (!alive) return;
        const found = (data || []).some(
          (c) => (c.target_user_id || c.id) === otherUserId,
        );
        setIsContact(found);
      })
      .catch(() => {
        if (alive) setIsContact(false);
      });
    return () => { alive = false; };
  }, [otherUserId]);

  const handleAddContact = useCallback(async () => {
    if (!otherUserId || addingContact) return;
    setAddingContact(true);
    try {
      await relationshipsApi.create({ target_user_id: otherUserId, type: 'contact' });
      setIsContact(true);
      toast.success(t('contacts.addedToast', {
        name: conversation?.display_name || conversation?.name || t('chat.conversation'),
      }), {
        indicator: <UserPlus size={16} />,
      });
    } catch (err) {
      toast.danger(err?.message || t('contacts.addError'));
    } finally {
      setAddingContact(false);
    }
  }, [otherUserId, addingContact, conversation?.display_name, conversation?.name, t]);

  // Resolve and apply wallpaper using URL conversationId (works before chat list loads)
  useEffect(() => {
    if (!conversationId) {
      setWallpaperStyle(null);
      return undefined;
    }

    const convType =
      conversation?.type ?? conversations.find((c) => c.id === conversationId)?.type;

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
      setWallpaperStyle({ backgroundColor: active.wallpaper_value });
    } else if (active.wallpaper_type === 'image' && active.storage_object_id) {
      const cached = getCachedUrl(active.storage_object_id);
      if (cached) {
        setWallpaperStyle({
          backgroundImage: `url(${cached})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        });
      } else {
        storageApi.getUrl(active.storage_object_id).then((res) => {
          if (cancelled) return;
          const url = res.data?.url;
          if (url) {
            cacheUrl(active.storage_object_id, url);
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
  }, [
    conversationId,
    conversation?.type,
    conversations,
    wallpapers,
    resolveWallpaper,
    getCachedUrl,
    cacheUrl,
  ]);

  useEffect(() => {
    if (!conversationId || !conversation || isDirect) {
      setMembers([]);
      return undefined;
    }
    let active = true;
    setLoadingMembers(true);
    conversationsApi
      .getMembers(conversationId)
      .then(({ data }) => { if (active) setMembers(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setMembers([]); })
      .finally(() => { if (active) setLoadingMembers(false); });
    return () => { active = false; };
  }, [conversationId, conversation, isDirect]);

  // Members are fetched once via REST; overlay live presence from the socket
  // so the member panel doesn't go stale while the conversation stays open.
  const membersWithPresence = useMemo(
    () => members.map((m) => ({ ...m, presence: onlineUsers[m.user_id] ?? m.presence })),
    [members, onlineUsers],
  );

  // Build typing text for this conversation
  const currentTyping = typingUsers[conversationId] || {};
  const typingNames = Object.entries(currentTyping)
    .filter(([uid]) => uid !== user?.id)
    .map(([, name]) => name);
  const typingText =
    typingNames.length === 1
      ? t('chat.isTyping', { name: typingNames[0] })
      : typingNames.length > 1
        ? t('chat.areTyping', { names: typingNames.join(', ') })
        : null;

  // Clear active conversation when leaving the page entirely
  useEffect(() => {
    return () => clearActiveConversation();
  }, [clearActiveConversation]);

  // Track pinned message ids so the context menu can offer pin/unpin.
  // The panel itself stays open across switches (it reloads per conversation).
  useEffect(() => {
    setPinnedIds(new Set());
    if (!conversationId) return undefined;
    let active = true;
    messagesApi.getPinned(conversationId)
      .then(({ data }) => {
        if (active) setPinnedIds(new Set((Array.isArray(data) ? data : []).map((m) => m.id)));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [conversationId]);

  const scrollContainerToBottom = useCallback((smooth = false) => {
    const el = containerRef.current;
    if (!el) return;
    const top = el.scrollHeight;
    if (smooth) {
      el.scrollTo({ top, behavior: 'smooth' });
    } else {
      el.scrollTop = top;
    }
  }, []);

  const startBottomAnchor = useCallback(() => {
    anchorBottomRef.current = true;
    if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    anchorTimerRef.current = setTimeout(() => {
      anchorBottomRef.current = false;
    }, 8000);
  }, []);

  // Layout effect on purpose: setActiveConversation's synchronous part
  // (restoring the cached timeline) lands before the browser paints, so
  // switching chats never flashes the previous conversation's messages.
  useLayoutEffect(() => {
    if (conversationId) {
      initialLoadRef.current = false;
      prevScrollHeightRef.current = null;
      loadingMoreRef.current = false;
      wasAtBottomRef.current = true;
      anchorBottomRef.current = false;
      prevScrollTopRef.current = 0;
      prevContentHeightRef.current = 0;
      if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
      setShowScrollBtn(false);
      setContextMenu(null);
      setActiveConversation(conversationId);
      // Aseguramos estar en la sala de socket de la conversación: el auto-join
      // del backend solo ocurre al conectar, así que reconexiones o salas nuevas
      // quedarían fuera y no llegarían los recibos (entregado/leído) en vivo.
      joinConversation(conversationId);
    }
    return () => {
      if (conversationId) emitTyping(conversationId, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, setActiveConversation, emitTyping, joinConversation]);

  // Load the saved draft when switching conversations, resetting composer state
  useEffect(() => {
    if (!conversationId) return;
    draftReadyRef.current = false;
    let active = true;
    setInput('');
    setReplyTo(null);
    setEditing(null);
    setThreadRoot(null);
    (async () => {
      try {
        const { data } = await messagesApi.getDraft(conversationId);
        if (active && data?.body) setInput(data.body);
      } catch {
        // no draft / ignore
      } finally {
        if (active) draftReadyRef.current = true;
      }
    })();
    return () => { active = false; };
  }, [conversationId]);

  // Debounced autosave of the draft as the user types (skipped while editing)
  useEffect(() => {
    if (!conversationId || !draftReadyRef.current || editing) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      const body = (input ?? '').trim();
      if (body) {
        messagesApi.saveDraft(conversationId, { body }).catch(() => {});
      } else {
        messagesApi.deleteDraft(conversationId).catch(() => {});
      }
    }, 600);
    return () => { if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current); };
  }, [input, conversationId, editing]);

  // Scroll to bottom on initial load / own new message, but not when loading
  // older messages. `conversationId` is a dependency on purpose: the messages
  // region remounts per conversation (keyed container), so the effect must
  // re-fire even when the cached `messages` array is already in place —
  // otherwise the fresh container would stay stuck at the top.
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null) return; // handled by the load-more layout effect
    if (loadingMoreRef.current) return;
    if (!containerRef.current || messages.length === 0) return;

    if (!initialLoadRef.current) {
      // First batch: jump instantly before paint so user never sees the top
      scrollContainerToBottom(false);
      wasAtBottomRef.current = true;
      initialLoadRef.current = true;
      startBottomAnchor();
      setShowScrollBtn(false);
      requestAnimationFrame(() => scrollContainerToBottom(false));
    } else if (wasAtBottomRef.current) {
      scrollContainerToBottom(true);
    }
  }, [messages, conversationId, scrollContainerToBottom, startBottomAnchor]);

  // Catch late layout shifts while still on initial open
  useLayoutEffect(() => {
    if (initialLoadRef.current || loadingMessages || messages.length === 0) return;
    scrollContainerToBottom(false);
    wasAtBottomRef.current = true;
    initialLoadRef.current = true;
    startBottomAnchor();
    setShowScrollBtn(false);
  }, [loadingMessages, messages.length, scrollContainerToBottom, startBottomAnchor]);

  // Re-scroll only when content grows (images/videos loading), not on user scroll
  useEffect(() => {
    const content = messagesContentRef.current;
    if (!content) return;
    prevContentHeightRef.current = content.getBoundingClientRect().height;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      const grew = h > prevContentHeightRef.current + 2;
      prevContentHeightRef.current = h;
      if (grew && (anchorBottomRef.current || wasAtBottomRef.current)) {
        scrollContainerToBottom(false);
      }
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [conversationId, scrollContainerToBottom]);

  // Restore scroll position after prepending older messages
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null) {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
      }
      prevScrollHeightRef.current = null;
      loadingMoreRef.current = false;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    if (scrollTop < prevScrollTopRef.current - 2) {
      // User scrolled up — stop auto-pinning to bottom
      anchorBottomRef.current = false;
      if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    }
    prevScrollTopRef.current = scrollTop;

    const distanceFromBottom = el.scrollHeight - scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 100;
    wasAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowScrollBtn(false);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    } else {
      setShowScrollBtn(true);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => setShowScrollBtn(false), 2000);
    }
    // Don't auto-load older messages until the initial scroll-to-bottom completed
    if (!initialLoadRef.current) return;
    if (el.scrollTop < 80 && hasMoreMessages && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadMoreMessages]);

  const scrollToBottom = () => {
    scrollContainerToBottom(true);
  };

  const handleSend = async () => {
    const body = (input ?? '').trim();
    if (!body) return;

    emitTyping(conversationId, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (editing) {
      if (!isWithinMessageWindow(editing.sent_at, MESSAGE_EDIT_WINDOW_MS)) {
        toast.danger(t('chat.editWindowExpired'));
        setEditing(null);
        return;
      }
      try {
        const bodyFormat = detectBodyFormat(body);
        await editMessage(editing.id, body, bodyFormat);
        setEditing(null);
      } catch (err) {
        toast.danger(err?.message || t('chat.editWindowExpired'));
        return;
      }
    } else {
      const bodyFormat = detectBodyFormat(body);
      const data = { conversation_id: conversationId, body, type: 'text', body_format: bodyFormat };
      if (replyTo) data.reply_to_id = replyTo.id;
      if (sendPulseTimerRef.current) clearTimeout(sendPulseTimerRef.current);
      setSendPulse(true);
      sendPulseTimerRef.current = setTimeout(() => setSendPulse(false), 400);
      await sendMessage(data, user);
      setReplyTo(null);
      // The message was sent — drop any saved draft for this conversation
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      messagesApi.deleteDraft(conversationId).catch(() => {});
    }
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (handleFormatShortcut(e, inputRef, setInput, t)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      cancelAction();
    }
  };

  const handleFilePick = useCallback((file) => {
    setPreviewFile(file);
  }, []);

  // Stickers & GIFs travel as a lightweight `sticker` message whose payload
  // lives in metadata; the body stays empty. Two sources:
  //   · custom — a user-uploaded sticker in storage (referenced by object_id)
  //   · giphy  — an external GIF hosted on Giphy's CDN (referenced by url)
  const handleStickerSend = useCallback(async (item) => {
    if (!item) return;
    const sticker =
      item.source === 'custom'
        ? {
            source: 'custom',
            kind: 'sticker',
            object_id: item.object_id,
            width: item.width || null,
            height: item.height || null,
          }
        : {
            source: item.source,      // 'giphy'
            kind: item.kind,          // 'gif'
            url: item.url,
            width: item.width || null,
            height: item.height || null,
            alt: item.alt || null,
          };
    if (sticker.source === 'custom' ? !sticker.object_id : !sticker.url) return;

    const data = { conversation_id: conversationId, type: 'sticker', metadata: { sticker } };
    if (replyTo) data.reply_to_id = replyTo.id;
    try {
      await sendMessage(data, user);
      setReplyTo(null);
    } catch (err) {
      console.error('Sticker send failed:', err);
    }
  }, [conversationId, replyTo, sendMessage, user]);

  const handleFileSend = useCallback(async (file, caption) => {
    setPreviewFile(null);
    setSendingFile(true);
    try {
      const objectType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'document';
      const { data: storageObj } = await storageApi.upload(file, objectType);
      const msgData = {
        conversation_id: conversationId,
        type: 'media',
        attachment_ids: [storageObj.id],
        _filename: file.name,
      };
      if (caption) {
        msgData.body = caption;
        msgData.body_format = detectBodyFormat(caption);
      }
      await sendMessage(msgData, user);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setSendingFile(false);
    }
  }, [conversationId, sendMessage, user]);

  // Drag & drop / paste-to-attach. Reuses the single-file preview flow: the
  // first dropped or pasted file opens the FilePreviewBar with a caption.
  const acceptDroppedFile = useCallback((file) => {
    if (file && !previewFile && !sendingFile) setPreviewFile(file);
  }, [previewFile, sendingFile]);

  const handleDragEnter = useCallback((e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); // allow drop
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) acceptDroppedFile(file);
  }, [acceptDroppedFile]);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            acceptDroppedFile(file);
            return;
          }
        }
      }
    }
    const text = e.clipboardData?.getData('text/plain');
    const parsed = parseCodeFence(text);
    if (parsed) {
      e.preventDefault();
      setCodeModalInitial(parsed);
      setShowCodeModal(true);
    }
  }, [acceptDroppedFile]);

  // Scroll to a message and briefly highlight it (search, reply, etc.)
  const scrollToMessage = useCallback((id, { closeSearch = false } = {}) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;

    const container = containerRef.current;
    if (container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const top = container.scrollTop
        + (elRect.top - containerRect.top)
        - (container.clientHeight / 2)
        + (elRect.height / 2);
      container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Flash with the live accent so the highlight follows the chosen palette
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5865f2';
    el.animate(
      [
        { backgroundColor: 'transparent' },
        { backgroundColor: `color-mix(in oklch, ${accent} 22%, transparent)`, offset: 0.2 },
        { backgroundColor: `color-mix(in oklch, ${accent} 22%, transparent)`, offset: 0.5 },
        { backgroundColor: 'transparent' },
      ],
      { duration: 1600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );

    if (closeSearch && window.innerWidth < 768) {
      setSearchOpen(false);
      setPinnedOpen(false);
    }
  }, []);

  const handleJumpToMessage = useCallback((id) => {
    scrollToMessage(id, { closeSearch: true });
  }, [scrollToMessage]);

  const focusMessageById = useCallback(async (id) => {
    if (!id) return;

    const tryScroll = () => {
      const el = document.getElementById(`msg-${id}`);
      if (el) {
        scrollToMessage(id);
        return true;
      }
      return false;
    };

    if (tryScroll()) return;

    let attempts = 0;
    while (
      useChatStore.getState().hasMoreMessages
      && !useChatStore.getState().messages.some((m) => m.id === id)
      && attempts < 15
    ) {
      await useChatStore.getState().loadMoreMessages();
      attempts += 1;
    }

    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    tryScroll();
  }, [scrollToMessage]);

  const handleEdit = useCallback((msg) => {
    if (!msg.body) return;
    setEditing(msg);
    setInput(msg.body);
    setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleReply = useCallback((msg) => {
    setReplyTo(msg);
    setEditing(null);
    setTimeout(() => {
      focusMessageById(msg.id);
      inputRef.current?.focus();
    }, 80);
  }, [focusMessageById]);

  // Opens confirm modal instead of deleting immediately
  const handleDeleteRequest = useCallback((msg) => {
    setDeleteTarget(msg);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (!isWithinMessageWindow(deleteTarget.sent_at, MESSAGE_DELETE_WINDOW_MS)) {
      toast.danger(t('chat.deleteWindowExpired'));
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteMessage(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      toast.danger(err?.message || t('chat.deleteWindowExpired'));
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const handleReact = useCallback(async (msgId, emoji) => {
    await addReaction(msgId, emoji);
  }, [addReaction]);

  const cancelAction = () => {
    setReplyTo(null);
    setEditing(null);
    setInput('');
  };

  const handleForward = useCallback((msg) => setForwardTarget(msg), []);
  const handleOpenInfo = useCallback((msg) => setInfoTarget(msg), []);

  // One-tap wave from the empty state
  const handleSayHi = useCallback(async () => {
    setSendingHi(true);
    try {
      await sendMessage(
        { conversation_id: conversationId, body: '👋', type: 'text', body_format: detectBodyFormat('👋') },
        user,
      );
    } finally {
      setSendingHi(false);
    }
  }, [conversationId, sendMessage, user]);

  // Thread, search and pinned panels share the right column — only one open at a time
  const handleOpenThread = useCallback((msg) => {
    setThreadRoot(msg);
    setSearchOpen(false);
    setPinnedOpen(false);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen((p) => !p);
    setThreadRoot(null);
    setPinnedOpen(false);
    setHistoryOpen(false);
  }, []);

  const handleOpenPinned = useCallback(() => {
    setPinnedOpen((p) => !p);
    setSearchOpen(false);
    setThreadRoot(null);
    setHistoryOpen(false);
  }, []);

  const handleOpenHistory = useCallback(() => {
    setHistoryOpen((p) => !p);
    setSearchOpen(false);
    setPinnedOpen(false);
    setThreadRoot(null);
  }, []);

  const startCall = useCallStore((s) => s.startCall);
  const callStatus = useCallStore((s) => s.status);
  const handleStartCall = useCallback(async (type) => {
    if (callStatus !== 'idle') {
      toast.danger(t('call.alreadyInCall'));
      return;
    }
    try {
      await startCall({
        conversationId,
        type,
        isGroup: conversation?.type !== 'direct',
        conversationName: conversation?.display_name || conversation?.name || t('chat.conversation'),
        self: user,
      });
    } catch (err) {
      const msg = err?.name === 'NotAllowedError'
        ? t('call.permissionDenied')
        : t('call.startFailed');
      toast.danger(msg);
    }
  }, [callStatus, startCall, conversationId, conversation, user, t]);

  const handleTogglePin = useCallback(async (message) => {
    const isPinned = pinnedIds.has(message.id);
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (isPinned) next.delete(message.id);
      else next.add(message.id);
      return next;
    });
    try {
      if (isPinned) {
        await messagesApi.unpin(conversationId, message.id);
        toast.success(t('chat.unpinnedToast'));
      } else {
        await messagesApi.pin(conversationId, message.id);
        toast.success(t('chat.pinnedToast'));
      }
    } catch {
      // revert on failure
      setPinnedIds((prev) => {
        const next = new Set(prev);
        if (isPinned) next.add(message.id);
        else next.delete(message.id);
        return next;
      });
    }
  }, [conversationId, pinnedIds, t]);

  const handleUnpinnedFromPanel = useCallback((msgId) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.delete(msgId);
      return next;
    });
  }, []);

  const handleSavedChange = useCallback((messageId, isSaved) => {
    patchMessage(messageId, { is_saved: isSaved });
  }, [patchMessage]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleOpenContextMenu = useCallback((messageId, pos) => {
    setContextMenu({ messageId, ...pos });
  }, []);

  const handleToggleSave = useCallback(async (message) => {
    const saved = !!message.is_saved;
    const next = !saved;
    handleSavedChange(message.id, next);
    try {
      if (next) await messagesApi.save(message.id);
      else await messagesApi.unsave(message.id);
    } catch {
      handleSavedChange(message.id, saved);
    }
  }, [handleSavedChange]);

  // Save a received custom sticker into my own collection (shared by reference).
  const handleSaveSticker = useCallback(async (message) => {
    const objectId = message.metadata?.sticker?.object_id;
    if (!objectId) return;
    try {
      await stickerApi.save(objectId);
      toast.success(t('sticker.savedToCollection'));
    } catch (err) {
      toast.danger(err?.message || t('sticker.uploadError'));
    }
  }, [t]);

  const contextMenuMessage = contextMenu
    ? messages.find((m) => m.id === contextMenu.messageId)
    : null;

  const contextMenuItems = contextMenuMessage
    ? buildMessageMenuItems({
        message: contextMenuMessage,
        isOwn: contextMenuMessage.sender_id === user?.id,
        saved: !!contextMenuMessage.is_saved,
        pinned: pinnedIds.has(contextMenuMessage.id),
        t,
        closeMenu: handleCloseContextMenu,
        onReply: handleReply,
        onOpenThread: handleOpenThread,
        onForward: handleForward,
        onEdit: handleEdit,
        onDelete: handleDeleteRequest,
        onToggleSave: handleToggleSave,
        onTogglePin: handleTogglePin,
        onInfo: handleOpenInfo,
        onSaveSticker: handleSaveSticker,
      })
    : [];

  const messageElements = useMemo(() => {
    const isDirect = conversation?.type === 'direct';
    const dayOf = (m) => (m?.sent_at ? new Date(m.sent_at).toDateString() : null);
    const els = [];
    messages.forEach((msg, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      // Un nuevo día corta el agrupamiento por remitente y agrega un separador.
      const dayChanged = !prev || dayOf(prev) !== dayOf(msg);
      const nextDayChanged = !next || dayOf(next) !== dayOf(msg);
      const isFirstInGroup = dayChanged || prev.sender_id !== msg.sender_id;
      const isLastInGroup = nextDayChanged || next.sender_id !== msg.sender_id;

      if (dayChanged) {
        els.push(<DaySeparator key={`day-${msg.id}`} date={msg.sent_at} />);
      }

      els.push(
        <MessageRow
          key={msg.id}
          message={msg}
          isOwn={msg.sender_id === user?.id}
          isDirect={isDirect}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          isContextOpen={contextMenu?.messageId === msg.id}
          shouldAnimateEntry={
            index === messages.length - 1
            || msg._status === 'sending'
            || !!msg._animateIn
          }
          onOpenContextMenu={handleOpenContextMenu}
          onScrollToReply={focusMessageById}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onReply={handleReply}
          onReact={handleReact}
          onForward={handleForward}
          onOpenThread={handleOpenThread}
          onRetry={retrySendMessage}
          currentUserId={user?.id}
          currentUser={user}
        />
      );
    });
    return els;
  }, [messages, user, conversation?.type, contextMenu?.messageId, handleOpenContextMenu, focusMessageById, handleEdit, handleDeleteRequest, handleReply, handleReact, handleForward, handleOpenThread, retrySendMessage]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const convName = conversation.display_name || conversation.name || t('chat.conversation');

  return (
    <>
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        message={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Forward modal */}
      <ForwardModal
        isOpen={!!forwardTarget}
        message={forwardTarget}
        conversations={conversations}
        currentConvId={conversationId}
        onClose={() => setForwardTarget(null)}
      />

      {/* Message info modal */}
      <MessageInfoModal
        isOpen={!!infoTarget}
        message={infoTarget}
        onClose={() => setInfoTarget(null)}
      />

      {/* Create poll modal */}
      <CreatePollModal
        isOpen={showPollModal}
        conversationId={conversationId}
        onClose={() => setShowPollModal(false)}
      />

      <CreateCodeModal
        isOpen={showCodeModal}
        conversationId={conversationId}
        initialBody={codeModalInitial.body}
        initialLanguage={codeModalInitial.language}
        onClose={() => setShowCodeModal(false)}
      />

      {wallpaperPickerOpen && (
        <WallpaperPicker
          isOpen={wallpaperPickerOpen}
          onClose={() => setWallpaperPickerOpen(false)}
          scope="conversation"
          scopeKey={conversationId}
          label={convName}
        />
      )}

      <div
        className={`relative flex h-full${wallpaperStyle ? '' : ' bg-transparent'}`}
        style={wallpaperStyle ?? undefined}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* ── Header (glass) ── */}
        <div className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-white/8 bg-ink-800/70 px-3 shadow-[0_2px_12px_-6px_rgba(0,0,0,0.5)] backdrop-blur-xl md:px-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="md:hidden h-7 w-7 min-w-0 shrink-0"
              onPress={() => navigate('/chat')}
            >
              <ArrowLeft size={18} />
            </Button>
            <motion.div
              key={conversationId}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="flex min-w-0 items-center gap-2 md:gap-3"
            >
            {isDirect ? (
              <>
                <UserAvatar
                  user={{ display_name: convName, presence: conversation.member_presence, avatar_url: conversation.other_avatar_url }}
                  size="sm"
                  showStatus
                />
                <h2 className="echo-display truncate text-2xl font-semibold tracking-tight leading-tight">{convName}</h2>
                {conversation.member_presence && (
                  <span className="hidden md:inline-block shrink-0 border-l border-ink-400/40 pl-3 text-[13px] capitalize text-ink-200">
                    {conversation.member_presence}
                  </span>
                )}
              </>
            ) : conversation.type === 'group' ? (
              <>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-600">
                  <Users size={15} strokeWidth={2.5} className="text-ink-100" />
                </div>
                <h2 className="echo-display truncate text-2xl font-semibold tracking-tight leading-tight">{convName}</h2>
                {conversation.member_count && (
                  <span className="hidden md:inline-block shrink-0 border-l border-ink-400/40 pl-3 text-[13px] text-ink-200">
                    {conversation.member_count} {t('chat.members')}
                  </span>
                )}
              </>
            ) : (
              <>
                <Hash size={22} strokeWidth={2.5} className="shrink-0 text-ink-200" />
                <h2 className="echo-display truncate text-2xl font-semibold tracking-tight leading-tight">{convName}</h2>
                {conversation.member_count && (
                  <span className="hidden md:inline-block shrink-0 border-l border-ink-400/40 pl-3 text-[13px] text-ink-200">
                    {conversation.member_count} {t('chat.members')}
                  </span>
                )}
              </>
            )}
            </motion.div>
          </div>

          <div className="flex items-center gap-0.5">
            {isDirect && isContact === false && (
              <Tooltip content={t('contacts.addFromChat')} placement="bottom">
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={handleAddContact}
                  isPending={addingContact}
                  className="h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground"
                  aria-label={t('contacts.addFromChat')}
                >
                  <UserPlus size={18} />
                </Button>
              </Tooltip>
            )}
            {conversation.type !== 'channel' && (
              <>
                <Tooltip content={t('call.startVoice')} placement="bottom">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={() => handleStartCall('voice')}
                    isDisabled={callStatus !== 'idle'}
                    className="h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground"
                  >
                    <Phone size={18} />
                  </Button>
                </Tooltip>
                <Tooltip content={t('call.startVideo')} placement="bottom">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={() => handleStartCall('video')}
                    isDisabled={callStatus !== 'idle'}
                    className="h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground"
                  >
                    <VideoIcon size={18} />
                  </Button>
                </Tooltip>
              </>
            )}
            <Tooltip content={t('chat.pinnedMessages')} placement="bottom">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={handleOpenPinned}
                className={[
                  'relative hidden h-8 w-8 min-w-0 rounded-md hover:bg-ink-600 hover:text-foreground sm:flex',
                  pinnedOpen ? 'bg-ink-600 text-foreground' : 'text-ink-100',
                ].join(' ')}
              >
                <Pin size={18} />
                {pinnedIds.size > 0 && (
                  <span className="pointer-events-none absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </Button>
            </Tooltip>
            <Tooltip content={t('chat.searchMessages')} placement="bottom">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={handleOpenSearch}
                className={[
                  'h-8 w-8 min-w-0 rounded-md hover:bg-ink-600 hover:text-foreground sm:flex',
                  searchOpen ? 'bg-ink-600 text-foreground' : 'hidden text-ink-100',
                ].join(' ')}
              >
                <Search size={18} />
              </Button>
            </Tooltip>
            <Dropdown>
              <Button isIconOnly size="sm" variant="ghost" className="h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground">
                <MoreVertical size={18} />
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu>
                  {isDirect && isContact === false && (
                    <Dropdown.Item id="addContact" textValue={t('contacts.addFromChat')} onAction={handleAddContact}>
                      <UserPlus size={15} />
                      <Label>{t('contacts.addFromChat')}</Label>
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item id="pinned" textValue={t('chat.pinnedMessages')} onAction={handleOpenPinned}>
                    <Pin size={15} />
                    <Label>{t('chat.pinnedMessages')}</Label>
                  </Dropdown.Item>
                  {conversation.type !== 'channel' && (
                    <Dropdown.Item id="callHistory" textValue={t('call.history.title')} onAction={handleOpenHistory}>
                      <Phone size={15} />
                      <Label>{t('call.history.title')}</Label>
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item id="wallpaper" textValue={t('chat.changeWallpaper')} onAction={() => setWallpaperPickerOpen(true)}>
                    <ImageIcon size={15} />
                    <Label>{t('chat.changeWallpaper')}</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>

        {/* ── Messages — keyed by conversation: fresh scroll container plus a
            soft crossfade instead of the old full-page remount jump ── */}
        <motion.div
          key={conversationId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: EASE_OUT }}
          className="relative flex-1 min-h-0"
        >
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto overflow-x-hidden pb-3"
          >
            <div ref={messagesContentRef}>
            {loadingMessages && messages.length === 0 && (
              <div className="flex flex-col gap-4 px-4 pt-6 sm:px-6" aria-label={t('chat.loadingMessages')} role="status">
                {[
                  { own: false, w: 'w-[52%]', h: 'h-14' },
                  { own: false, w: 'w-[38%]', h: 'h-9' },
                  { own: true,  w: 'w-[44%]', h: 'h-11' },
                  { own: false, w: 'w-[60%]', h: 'h-16' },
                  { own: true,  w: 'w-[30%]', h: 'h-9' },
                  { own: true,  w: 'w-[48%]', h: 'h-12' },
                  { own: false, w: 'w-[42%]', h: 'h-10' },
                ].map((row, i) => (
                  <div key={i} className={`flex items-end gap-2 ${row.own ? 'flex-row-reverse' : ''}`}>
                    {!row.own && <div className="echo-shimmer h-8 w-8 shrink-0 rounded-full" />}
                    <div
                      className={[
                        'echo-shimmer max-w-[70%] rounded-2xl',
                        row.own ? 'rounded-tr-md' : 'rounded-tl-md',
                        row.w,
                        row.h,
                      ].join(' ')}
                      style={{ opacity: 1 - i * 0.09 }}
                    />
                  </div>
                ))}
              </div>
            )}

            {hasMoreMessages && !loadingMessages && (
              <div className="flex justify-center py-2">
                <Button
                  variant="ghost"
                  onPress={() => {
                    loadingMoreRef.current = true;
                    prevScrollHeightRef.current = containerRef.current?.scrollHeight ?? null;
                    loadMoreMessages();
                  }}
                  className="flex h-auto items-center gap-1.5 rounded-md border border-ink-400/40 bg-ink-800 px-3 py-1 text-xs text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
                >
                  <ArrowUp size={12} />
                  {t('chat.loadMore')}
                </Button>
              </div>
            )}

            {loadingMessages && messages.length > 0 && (
              <div className="flex justify-center py-3">
                <Spinner size="sm" />
              </div>
            )}

            {/* Conversation welcome when we hit the top */}
            {!hasMoreMessages && !loadingMessages && messages.length > 0 && (
              <div className="mb-4 px-4 pt-6">
                <div className="echo-grad-brand echo-glow-md echo-on-accent mb-3 flex h-16 w-16 items-center justify-center rounded-2xl">
                  {isDirect
                    ? <AtSign size={32} />
                    : <Hash size={32} strokeWidth={2} />}
                </div>
                <h3 className="echo-display text-3xl font-semibold">
                  {isDirect ? convName : <>{t('chat.welcomeTo')} <span className="echo-grad-text">#{convName}</span></>}
                </h3>
                <p className="mt-1 text-[14px] text-ink-100">
                  {isDirect
                    ? t('chat.startOfDirect', { name: convName })
                    : t('chat.startOfChannel', { name: convName })}
                </p>
              </div>
            )}

            {messageElements}
            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Scroll to bottom button */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={scrollToBottom}
                className="echo-glass-strong echo-press absolute bottom-4 right-6 flex h-10 w-10 items-center justify-center rounded-full text-ink-50 transition-colors hover:text-accent"
              >
                <ArrowDown size={15} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Empty conversation — invite to break the ice */}
          <AnimatePresence>
            {!loadingMessages && !hasMoreMessages && messages.length === 0 && (
              <EmptyConversationState
                conversation={conversation}
                convName={convName}
                onSayHi={handleSayHi}
                sending={sendingHi}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Reply / Edit banner (above input) ── */}
        <AnimatePresence initial={false}>
          {(replyTo || editing) && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative mx-3 -mb-2 flex items-center gap-3 rounded-t-lg border-b border-ink-900 bg-ink-800 px-4 py-1.5 text-[13px]"
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${editing ? 'bg-echo-idle text-eclipse' : 'bg-accent text-accent-foreground'}`}>
                {editing ? <Pencil size={11} /> : <CornerUpLeft size={11} />}
              </span>
              {replyTo && !editing ? (
                <button
                  type="button"
                  title={t('chat.jumpToOriginal')}
                  onClick={() => focusMessageById(replyTo.id)}
                  className="echo-press min-w-0 flex-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-ink-750/80"
                >
                  <p className="truncate text-ink-100">
                    <span className="font-semibold text-foreground">
                      {t('chat.replyingTo', { name: replyTo.sender_display_name })}
                    </span>
                    {' — '}
                    <span className="text-ink-200">{replyTo.body}</span>
                  </p>
                </button>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink-100">
                    <span className="font-semibold text-foreground">
                      {editing ? t('chat.editingMessage') : t('chat.replyingTo', { name: replyTo.sender_display_name })}
                    </span>
                    {' — '}
                    <span className="text-ink-200">
                      {editing ? editing.body : replyTo.body}
                    </span>
                  </p>
                </div>
              )}
              <Button
                isIconOnly
                variant="ghost"
                onPress={cancelAction}
                className="h-auto w-auto min-w-0 rounded-full p-1 text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
              >
                <X size={14} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── File preview bar ── */}
        <AnimatePresence initial={false}>
          {previewFile && (
            <FilePreviewBar
              file={previewFile}
              onSend={handleFileSend}
              onCancel={() => setPreviewFile(null)}
            />
          )}
        </AnimatePresence>

        {/* ── Input area (floating composer) ── */}
        <FloatingComposer
          elevationOnFocus
          footer={
            <div className="relative h-4">
              <AnimatePresence initial={false}>
                {typingText && (
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.16 }}
                    className="absolute inset-x-0 top-1 flex items-center gap-2 px-2 text-[12px] text-ink-100"
                  >
                    <TypingDots />
                    <span>{typingText}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          }
        >
          <div className="flex min-w-0 w-full flex-1 items-center gap-1 sm:gap-2">
            <FilePickerMenu
              onPick={handleFilePick}
              onPoll={() => setShowPollModal(true)}
              onCode={() => {
                setCodeModalInitial({ body: '', language: 'plaintext' });
                setShowCodeModal(true);
              }}
              disabled={!!previewFile || sendingFile}
              uploading={sendingFile}
              open={activePicker === 'file'}
              onOpenChange={(next) => setActivePicker(next ? 'file' : null)}
            />

            <DynamicMessageInput
              ref={inputRef}
              placeholder={isDirect
                ? t('chat.writeMessage') + ` @${convName}`
                : t('chat.writeMessage') + ` #${convName}`}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                emitTyping(conversationId, true);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  emitTyping(conversationId, false);
                }, 2000);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />

            {isDirect && (
              <GamePickerMenu
                conversationId={conversationId}
                disabled={!!previewFile || sendingFile}
                open={activePicker === 'game'}
                onOpenChange={(next) => setActivePicker(next ? 'game' : null)}
              />
            )}

            <StickerGifPicker
              onPick={handleStickerSend}
              disabled={!!previewFile || sendingFile}
              open={activePicker === 'sticker'}
              onOpenChange={(next) => setActivePicker(next ? 'sticker' : null)}
            />

            <EmojiPicker
              onPick={(emoji) => {
                setInput((v) => v + emoji);
                inputRef.current?.focus();
              }}
              open={activePicker === 'emoji'}
              onOpenChange={(next) => setActivePicker(next ? 'emoji' : null)}
            />

            <SendButton
              onPress={handleSend}
              isDisabled={!(input ?? '').trim()}
              label={t('chat.send')}
              pulse={sendPulse}
              className="shrink-0"
            />
          </div>
        </FloatingComposer>
        </div>

        <PresenceAvatarStack
          members={membersWithPresence}
          loading={loadingMembers}
          className="mr-1"
        />

        {/* ── Message search panel ── */}
        <AnimatePresence>
          {searchOpen && (
            <MessageSearchPanel
              conversationId={conversationId}
              onClose={() => setSearchOpen(false)}
              onJump={handleJumpToMessage}
            />
          )}
        </AnimatePresence>

        {/* ── Pinned messages panel ── */}
        <AnimatePresence>
          {pinnedOpen && (
            <PinnedMessagesPanel
              conversationId={conversationId}
              onClose={() => setPinnedOpen(false)}
              onJump={handleJumpToMessage}
              onUnpinned={handleUnpinnedFromPanel}
            />
          )}
        </AnimatePresence>

        {/* ── Call history panel ── */}
        <AnimatePresence>
          {historyOpen && (
            <CallHistoryPanel
              conversationId={conversationId}
              selfId={user?.id}
              onClose={() => setHistoryOpen(false)}
              onCallAgain={(type) => { setHistoryOpen(false); handleStartCall(type); }}
            />
          )}
        </AnimatePresence>

        {/* ── Thread panel ── */}
        <AnimatePresence>
          {threadRoot && (
            <ThreadPanel
              key={threadRoot.id}
              root={threadRoot}
              conversationId={conversationId}
              onClose={() => setThreadRoot(null)}
            />
          )}
        </AnimatePresence>

        {/* ── Drag & drop overlay ── */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-ink-900/70 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.92, y: 6 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96 }}
                transition={{ duration: 0.18, ease: SPRING_OUT }}
                className="flex flex-col items-center gap-3 px-10 py-8 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
                  <Upload size={26} className="text-accent" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{t('chat.dropFiles')}</p>
                  <p className="mt-0.5 text-[13px] text-ink-100">{t('chat.dropFilesHint')}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Message context menu (single instance per conversation) ── */}
        <AnimatePresence>
          {contextMenu && contextMenuMessage && (
            <MessageContextMenu
              pos={contextMenu}
              onClose={handleCloseContextMenu}
              quickEmojis={QUICK_EMOJIS}
              onEmoji={(em) => { handleCloseContextMenu(); handleReact(contextMenuMessage.id, em); }}
              items={contextMenuItems}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
