import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Dropdown, Label, Spinner, Tooltip, Modal } from '@heroui/react';
import {
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Search,
  Pin,
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
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CornerUpLeft,
  Download,
  Check,
  CheckCheck,
  X,
  AlertTriangle,
  Loader,
  AlertCircle,
  RefreshCw,
  Image,
  Film,
  FileText,
  Send,
  BarChart3,
  Upload,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import ImageViewer from '@/components/ImageViewer';
import PdfPreview from '@/components/PdfPreview';
import SendButton from '@/components/SendButton';
import MessageSearchPanel from '@/components/MessageSearchPanel';
import PollMessage from '@/components/PollMessage';
import CreatePollModal from '@/components/CreatePollModal';
import { formatMessageTime, formatFullTime } from '@/lib/dates';
import { storageApi, messagesApi } from '@/lib/endpoints';

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

const EASE_OUT = [0.34, 1, 0.64, 1];
const SPRING_OUT = [0.34, 1.56, 0.64, 1];

/* ─────────────────────────── File Picker Menu ─────────────────────────── */
function FilePickerMenu({ onPick, disabled, uploading }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const docRef   = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (ref) => { setOpen(false); ref.current?.click(); };

  const MENU_ITEMS = [
    { icon: Image,    label: t('chat.attachImage'),    ref: imageRef, accept: 'image/*' },
    { icon: Film,     label: t('chat.attachVideo'),    ref: videoRef, accept: 'video/*' },
    { icon: FileText, label: t('chat.attachDocument'), ref: docRef,   accept: '*/*' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      {MENU_ITEMS.map(({ ref, accept }) => (
        <input
          key={accept}
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onPick(f); e.target.value = ''; } }}
        />
      ))}

      <Tooltip content={t('chat.attachFile')} placement="top">
        <Button
          isIconOnly
          variant="ghost"
          isDisabled={disabled}
          onPress={() => setOpen((p) => !p)}
          className="flex h-8 w-8 min-w-0 shrink-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          {uploading ? <Loader size={18} className="animate-spin" /> : <Paperclip size={18} />}
        </Button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute bottom-11 left-0 z-30 min-w-48 overflow-hidden rounded-lg border border-ink-400/40 bg-ink-850 shadow-xl"
          >
            {MENU_ITEMS.map(({ icon: Icon, label, ref }) => (
              <Button
                key={label}
                variant="ghost"
                onPress={() => pick(ref)}
                className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-3 py-2 text-[14px] text-ink-50 transition-colors hover:bg-blurple-500 hover:text-white"
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────── Emoji Picker (input) ─────────────────────────── */
const EMOJIS = [
  '😀', '😂', '🥹', '😊', '😍', '😎', '🤔', '😅',
  '😉', '🙃', '😴', '😭', '😡', '🥳', '🤩', '😘',
  '🥰', '🤗', '🤓', '😬', '😮', '👀', '🫡', '🤯',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '🔥',
  '❤️', '💯', '🎉', '✅', '❌', '⭐', '💡', '🚀',
];

function EmojiPicker({ onPick }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Tooltip content={t('chat.emoji')} placement="top">
        <Button
          isIconOnly
          variant="ghost"
          onPress={() => setOpen((p) => !p)}
          className="flex h-8 w-8 min-w-0 shrink-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          <Smile size={18} />
        </Button>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute bottom-11 right-0 z-30 w-[296px] rounded-lg border border-ink-400/40 bg-ink-850 p-2 shadow-xl"
          >
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJIS.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  onPress={() => { onPick(emoji); setOpen(false); }}
                  className="flex h-8 w-8 min-w-0 items-center justify-center rounded-md p-0 text-lg transition-transform hover:scale-125 hover:bg-ink-750"
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
            ? <Image size={14} className="shrink-0 text-blurple-400" />
            : isVideo
              ? <Film size={14} className="shrink-0 text-blurple-400" />
              : <FileText size={14} className="shrink-0 text-blurple-400" />}
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
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-blurple-500/20">
                <FileText size={28} className="text-blurple-400" />
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
            className="shrink-0 rounded-md bg-blurple-500 text-white hover:bg-blurple-600"
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
function ConfirmDeleteModal({ message, onConfirm, onCancel }) {
  const { t } = useTranslation();
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: SPRING_OUT }}
        className="relative z-10 mx-4 w-full max-w-md overflow-hidden rounded-md bg-ink-850 shadow-2xl ring-1 ring-black/40"
      >
        <div className="p-5">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-echo-dnd/15">
              <AlertTriangle size={18} className="text-echo-dnd" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-foreground">{t('chat.deleteMessage')}</h3>
              <p className="mt-0.5 text-[13px] text-ink-100">
                {t('chat.deleteMessageWarning')}
              </p>
            </div>
          </div>

          {message?.body && message.type !== 'media' && (
            <div className="mb-5 rounded-md border border-ink-400/40 bg-ink-800 px-3 py-2 text-[14px] text-ink-100 line-clamp-3">
              {message.body}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onPress={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              className="bg-echo-dnd text-white hover:bg-echo-dnd/90"
              onPress={onConfirm}
            >
              <Trash2 size={13} />
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────── Attachment View ─────────────────────────── */
// Module-level cache so each attachment URL is only fetched once per session,
// regardless of React StrictMode remounts or the same attachment appearing
// in multiple messages.  Values are either a resolved URL string or an
// in-flight Promise, so concurrent mounts share the same request.
const _attachmentUrlCache = new Map();

function AttachmentView({ attachment }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(() => _attachmentUrlCache.get(attachment.id) ?? null);
  const [viewerOpen, setViewerOpen] = useState(false);
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
        className={`animate-pulse rounded-lg bg-ink-800 ${
          isImage || isVideo || isPdf ? 'h-48 w-[280px]' : 'h-9 w-44'
        }`}
      />
    );
  }

  if (isImage) {
    return (
      <>
        <div
          className="group relative inline-block cursor-zoom-in overflow-hidden rounded-lg"
          onClick={() => setViewerOpen(true)}
        >
          <img
            src={url}
            alt={attachment.original_filename}
            className="max-h-80 max-w-[min(400px,70vw)] object-cover"
          />
          <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
        </div>
        {viewerOpen && (
          <ImageViewer
            src={url}
            filename={attachment.original_filename}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </>
    );
  }

  if (isVideo) {
    return (
      <div className="group relative overflow-hidden rounded-lg bg-black">
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-80 max-w-[min(400px,70vw)] rounded-lg"
        />
        <Button
          isIconOnly
          variant="ghost"
          onPress={() => downloadBlob(url, attachment.original_filename)}
          className="absolute right-2 top-2 h-auto w-auto min-w-0 rounded-md bg-black/70 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/90 group-hover:opacity-100"
          title={t('common.download')}
        >
          <Download size={13} />
        </Button>
      </div>
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blurple-500/20">
        <Paperclip size={14} className="text-blurple-400" />
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
          ? 'border-blurple-400/70 bg-blurple-500/20 text-blurple-300 shadow-[0_0_12px_-4px_rgba(88,101,242,0.7)] hover:bg-blurple-500/30'
          : 'border-ink-400/40 bg-ink-800/70 text-ink-50 hover:border-blurple-400/50 hover:bg-ink-750',
      ].join(' ')}
    >
      <span className="text-[14px]">{emoji}</span>
      <span>{count}</span>
    </Button>
  );
}

// Delivery receipt — only rendered on the user's own (accent) bubbles.
function ReceiptIcon({ message }) {
  if (message._status === 'sending') return <Loader size={13} className="animate-spin text-white/70" />;
  if (message._status === 'error')   return <AlertCircle size={13} className="text-red-200" />;
  if (message.read_count > 0)        return <CheckCheck size={13} className="text-sky-300" />;
  if (message.delivered_count > 0)   return <CheckCheck size={13} className="text-white/70" />;
  return <Check size={13} className="text-white/70" />;
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
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-80" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: coords.ready ? 1 : 0, scale: coords.ready ? 1 : 0.94 }}
        transition={{ duration: 0.13, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ left: coords.left, top: coords.top, transformOrigin: 'top left' }}
        className="echo-glass-strong fixed w-56 overflow-hidden rounded-2xl p-1.5"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
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
                  : 'text-ink-50 hover:bg-blurple-500 hover:text-white',
              ].join(' ')}
            >
              <it.icon size={16} className="shrink-0" />
              <span className="truncate">{it.label}</span>
            </button>
          ) : null
        )}
      </motion.div>
    </div>,
    document.body
  );
}

const MessageRow = memo(function MessageRow({ message, isOwn, isDirect, isFirstInGroup, isLastInGroup, onEdit, onDelete, onReply, onReact, onForward, onRetry, currentUserId, currentUser }) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(null); // { x, y } | null
  const [saved, setSaved] = useState(false);
  const longPressTimer = useRef(null);

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      if (next) await messagesApi.save(message.id);
      else await messagesApi.unsave(message.id);
    } catch {
      setSaved(!next); // revert on failure
    }
  };

  const isPending = message._status === 'sending' || message._status === 'error';
  const canEdit = isOwn && (message.type !== 'media' || message.body);
  const canCopy = !!message.body;

  const displayName = isOwn
    ? (currentUser?.display_name || message.sender_display_name || 'Tú')
    : message.sender_display_name;
  const avatarUrl = isOwn
    ? currentUser?.avatar_url
    : message.sender_avatar_url;

  const showName = !isOwn && !isDirect && isFirstInGroup;
  const showAvatar = !isOwn && !isDirect;

  // ── Context-menu (right-click / long-press) ──
  const actionable = !isPending && !message.is_deleted;
  const closeMenu = useCallback(() => setMenu(null), []);
  const openMenu = (e) => {
    if (!actionable) return;
    e.preventDefault();
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    setMenu({ x, y });
  };
  const handleTouchStart = (e) => {
    if (!actionable) return;
    const t0 = e.touches[0];
    const { clientX, clientY } = t0;
    longPressTimer.current = setTimeout(() => setMenu({ x: clientX, y: clientY }), 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const menuItems = menu
    ? [
        { key: 'reply', icon: Reply, label: t('chat.reply'), onClick: () => { closeMenu(); onReply(message); } },
        { key: 'forward', icon: Forward, label: t('chat.forward'), onClick: () => { closeMenu(); onForward(message); } },
        canCopy && { key: 'copy', icon: Copy, label: t('chat.copyText'), onClick: () => { closeMenu(); navigator.clipboard?.writeText(message.body); } },
        { key: 'save', icon: saved ? BookmarkCheck : Bookmark, label: saved ? t('saved.remove') : t('chat.save'), onClick: () => { closeMenu(); toggleSave(); } },
        canEdit && { key: 'edit', icon: Pencil, label: t('common.edit'), onClick: () => { closeMenu(); onEdit(message); } },
        isOwn && { key: 'delete', icon: Trash2, label: t('common.delete'), danger: true, onClick: () => { closeMenu(); onDelete(message); } },
      ]
    : [];

  const isMediaOnly =
    message.type === 'media' && message.attachments?.length > 0 && !message.body;

  // WhatsApp-style asymmetric corners: the "tail" corner is squared off on the
  // first bubble of a group, on the side the bubble is anchored to.
  const bubbleClass = [
    'relative max-w-full transition-shadow',
    isMediaOnly ? 'overflow-hidden p-1' : 'px-3 py-1.5',
    isOwn
      ? 'echo-grad-own text-white shadow-[0_4px_18px_-6px_rgba(88,101,242,0.55)] ring-1 ring-white/10'
      : 'bg-ink-800/85 text-ink-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.06]',
    'rounded-2xl',
    isFirstInGroup ? (isOwn ? 'rounded-tr-md' : 'rounded-tl-md') : '',
    menu ? (isOwn ? 'ring-2 ring-white/40' : 'ring-2 ring-blurple-400/60') : '',
  ].join(' ');

  const metaClass = isOwn ? 'text-white/70' : 'text-ink-200';

  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onContextMenu={openMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
      className={[
        'echo-msg-row group relative flex gap-2 rounded-lg px-3 transition-colors sm:px-4',
        isFirstInGroup ? 'mt-3' : 'mt-0.5',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        menu ? 'bg-white/4' : 'hover:bg-white/2.5',
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
        <div className={bubbleClass}>
          {/* Sender name (group chats, first in group) */}
          {showName && (
            <p className="mb-0.5 text-[13px] font-semibold text-blurple-400">{displayName}</p>
          )}

          {/* Reply preview */}
          {message.reply_to_id && (message.reply_to_body || message.reply_to_type) && (
            <div className={[
              'mb-1 flex flex-col gap-0.5 rounded-md border-l-[3px] px-2 py-1 text-[12px]',
              isOwn ? 'border-white/70 bg-black/15' : 'border-blurple-400 bg-black/10',
            ].join(' ')}>
              {message.reply_to_sender && (
                <span className={isOwn ? 'font-semibold text-white/90' : 'font-semibold text-blurple-400'}>
                  {message.reply_to_sender}
                </span>
              )}
              <span className={['truncate', isOwn ? 'text-white/70' : 'text-ink-200'].join(' ')}>
                {message.reply_to_type === 'media'
                  ? <span className="inline-flex items-center gap-1"><Paperclip size={11} />{t('chat.attachedFile')}</span>
                  : message.reply_to_body}
              </span>
            </div>
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

              {/* Body */}
              {message.type !== 'media' && message.type !== 'poll' && message.body && (
                <p className={[
                  'wrap-break-word whitespace-pre-wrap text-[15px] leading-[1.4]',
                  message._status === 'sending' ? 'opacity-70' : '',
                  message._status === 'error' ? (isOwn ? 'text-red-100' : 'text-echo-dnd') : '',
                ].join(' ')}>
                  {message.body}
                </p>
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
                  <Loader size={13} className={`animate-spin shrink-0 ${isOwn ? 'text-white/80' : 'text-blurple-400'}`} />
                  <span className={`max-w-64 truncate ${isOwn ? 'text-white/80' : 'text-ink-100'}`}>{message._filename || t('chat.uploadingFile')}</span>
                </div>
              )}
            </>
          )}

          {/* Meta line: edited · time · receipt */}
          <div className={['mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none', metaClass, isMediaOnly ? 'px-1 pb-0.5' : ''].join(' ')}>
            {message.is_edited && !message.is_deleted && <span>{t('chat.edited')}</span>}
            <span title={formatFullTime(message.sent_at)}>{formatMessageTime(message.sent_at)}</span>
            {isOwn && !message.is_deleted && <ReceiptIcon message={message} />}
          </div>
        </div>

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
              className="echo-press flex h-auto items-center rounded-full border border-ink-400/40 bg-ink-800/70 px-1.5 py-0.5 text-ink-200 transition-colors hover:border-blurple-400/60 hover:text-foreground"
              title={t('chat.react')}
            >
              <Smile size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Right-click / long-press context menu */}
      {menu && (
        <MessageContextMenu
          pos={menu}
          onClose={closeMenu}
          quickEmojis={QUICK_EMOJIS}
          onEmoji={(em) => { closeMenu(); onReact(message.id, em); }}
          items={menuItems}
        />
      )}
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
                      className={`flex h-auto w-full items-center justify-start gap-3 rounded-md px-2 py-2 text-left transition-colors ${isSel ? 'bg-blurple-500/15' : 'hover:bg-ink-750'}`}
                    >
                      {c.type === 'direct' ? (
                        <UserAvatar user={{ display_name: name, avatar_url: c.other_avatar_url }} size="sm" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-ink-100"><Hash size={15} /></div>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                      {isSel && <Check size={16} className="text-blurple-400" />}
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
  } = useChatStore();

  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // message object to confirm delete
  const [previewFile, setPreviewFile] = useState(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [forwardTarget, setForwardTarget] = useState(null); // message being forwarded
  const [showPollModal, setShowPollModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0); // tracks nested dragenter/dragleave events

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevScrollHeightRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const wasAtBottomRef = useRef(true);
  const initialLoadRef = useRef(false); // true after first batch of messages is rendered
  const scrollIdleTimerRef = useRef(null);
  const draftReadyRef = useRef(false);  // true once the draft for this conv has loaded
  const draftSaveTimerRef = useRef(null);

  const conversation = getActiveConversation();

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

  useEffect(() => {
    if (conversationId) {
      initialLoadRef.current = false;
      setActiveConversation(conversationId);
    }
    return () => {
      if (conversationId) emitTyping(conversationId, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, setActiveConversation, emitTyping]);

  // Load the saved draft when switching conversations, resetting composer state
  useEffect(() => {
    if (!conversationId) return;
    draftReadyRef.current = false;
    let active = true;
    setInput('');
    setReplyTo(null);
    setEditing(null);
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

  // Scroll to bottom on initial load / own new message, but not when loading older messages
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null) return; // handled by the load-more layout effect
    if (loadingMoreRef.current) return;
    const el = containerRef.current;
    if (!el || messages.length === 0) return;
    if (!initialLoadRef.current) {
      // First batch: jump instantly before paint so user never sees the top
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
      wasAtBottomRef.current = true;
      initialLoadRef.current = true;
    } else if (wasAtBottomRef.current) {
      // New message while already at bottom: smooth scroll
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    wasAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowScrollBtn(false);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    } else {
      setShowScrollBtn(true);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => setShowScrollBtn(false), 2000);
    }
    if (el.scrollTop < 80 && hasMoreMessages && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadMoreMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    const body = (input ?? '').trim();
    if (!body) return;

    emitTyping(conversationId, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (editing) {
      await editMessage(editing.id, body);
      setEditing(null);
    } else {
      const data = { conversation_id: conversationId, body, type: 'text' };
      if (replyTo) data.reply_to_id = replyTo.id;
      await sendMessage(data, user);
      setReplyTo(null);
      // The message was sent — drop any saved draft for this conversation
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      messagesApi.deleteDraft(conversationId).catch(() => {});
    }
    setInput('');
  };

  const handleKeyDown = (e) => {
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
      if (caption) msgData.body = caption;
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
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          acceptDroppedFile(file);
          break;
        }
      }
    }
  }, [acceptDroppedFile]);

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
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Opens confirm modal instead of deleting immediately
  const handleDeleteRequest = useCallback((msg) => {
    setDeleteTarget(msg);
  }, []);

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await deleteMessage(deleteTarget.id);
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

  // Scroll to a message by id (used by the search panel). Briefly highlights it
  // when the message is currently loaded in the DOM. The flash is done with the
  // Web Animations API so no global CSS is needed.
  const handleJumpToMessage = useCallback((id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [
        { backgroundColor: 'rgba(88, 101, 242, 0)' },
        { backgroundColor: 'rgba(88, 101, 242, 0.22)', offset: 0.2 },
        { backgroundColor: 'rgba(88, 101, 242, 0.22)', offset: 0.5 },
        { backgroundColor: 'rgba(88, 101, 242, 0)' },
      ],
      { duration: 1600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    if (window.innerWidth < 768) setSearchOpen(false);
  }, []);

  const handleForward = useCallback((msg) => setForwardTarget(msg), []);

  const messageElements = useMemo(() => {
    const isDirect = conversation?.type === 'direct';
    return messages.map((msg, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      const isFirstInGroup = !prev || prev.sender_id !== msg.sender_id;
      const isLastInGroup  = !next || next.sender_id !== msg.sender_id;
      return (
        <MessageRow
          key={msg.id}
          message={msg}
          isOwn={msg.sender_id === user?.id}
          isDirect={isDirect}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onReply={handleReply}
          onReact={handleReact}
          onForward={handleForward}
          onRetry={retrySendMessage}
          currentUserId={user?.id}
          currentUser={user}
        />
      );
    });
  }, [messages, user, conversation?.type, handleEdit, handleDeleteRequest, handleReply, handleReact, handleForward, retrySendMessage]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const convName = conversation.display_name || conversation.name || t('chat.conversation');
  const isDirect = conversation.type === 'direct';

  return (
    <>
      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDeleteModal
            message={deleteTarget}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
          />
        )}
      </AnimatePresence>

      {/* Forward modal */}
      <ForwardModal
        isOpen={!!forwardTarget}
        message={forwardTarget}
        conversations={conversations}
        currentConvId={conversationId}
        onClose={() => setForwardTarget(null)}
      />

      {/* Create poll modal */}
      <CreatePollModal
        isOpen={showPollModal}
        conversationId={conversationId}
        onClose={() => setShowPollModal(false)}
      />

      <div
        className="relative flex h-full bg-transparent"
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
            {isDirect ? (
              <>
                <AtSign size={20} className="shrink-0 text-ink-200" />
                <h2 className="truncate text-[15px] font-semibold leading-tight">{convName}</h2>
                {conversation.member_presence && (
                  <span className="hidden md:inline-block shrink-0 border-l border-ink-400/40 pl-3 text-[13px] capitalize text-ink-200">
                    {conversation.member_presence}
                  </span>
                )}
              </>
            ) : (
              <>
                <Hash size={22} strokeWidth={2.5} className="shrink-0 text-ink-200" />
                <h2 className="truncate text-[15px] font-semibold leading-tight">{convName}</h2>
                {conversation.member_count && (
                  <span className="hidden md:inline-block shrink-0 border-l border-ink-400/40 pl-3 text-[13px] text-ink-200">
                    {conversation.member_count} {t('chat.members')}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <Tooltip content={t('chat.voiceCall')} placement="bottom">
              <Button isIconOnly size="sm" variant="ghost" className="hidden h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground sm:flex">
                <Phone size={18} />
              </Button>
            </Tooltip>
            <Tooltip content={t('chat.videoCall')} placement="bottom">
              <Button isIconOnly size="sm" variant="ghost" className="hidden h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground sm:flex">
                <Video size={18} />
              </Button>
            </Tooltip>
            <Tooltip content={t('chat.pinnedMessages')} placement="bottom">
              <Button isIconOnly size="sm" variant="ghost" className="hidden h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground sm:flex">
                <Pin size={18} />
              </Button>
            </Tooltip>
            <Tooltip content={t('chat.searchMessages')} placement="bottom">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => setSearchOpen((p) => !p)}
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
                  <Dropdown.Item id="pinned" textValue={t('chat.pinnedMessages')}>
                    <Pin size={15} />
                    <Label>{t('chat.pinnedMessages')}</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto overflow-x-hidden pb-3"
          >
            {loadingMessages && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink-200">
                <Spinner size="lg" />
                <p className="text-xs">{t('chat.loadingMessages')}</p>
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
                <div className="echo-grad-brand mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-[0_8px_24px_-8px_rgba(88,101,242,0.6)]">
                  {isDirect
                    ? <AtSign size={32} />
                    : <Hash size={32} strokeWidth={2} />}
                </div>
                <h3 className="text-2xl font-extrabold">
                  {isDirect ? convName : <>Bienvenido a <span className="echo-grad-text">#{convName}</span></>}
                </h3>
                <p className="mt-1 text-[14px] text-ink-100">
                  {isDirect
                    ? `Este es el comienzo de tu historial de mensajes con ${convName}.`
                    : `Este es el comienzo del canal #${convName}.`}
                </p>
              </div>
            )}

            {messageElements}
            <div ref={messagesEndRef} />
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
                className="echo-glass-strong echo-press absolute bottom-4 right-6 flex h-10 w-10 items-center justify-center rounded-full text-ink-50 transition-colors hover:text-blurple-300"
              >
                <ArrowDown size={15} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ── Reply / Edit banner (above input) ── */}
        <AnimatePresence initial={false}>
          {(replyTo || editing) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="relative mx-3 -mb-2 flex items-center gap-3 rounded-t-lg border-b border-ink-900 bg-ink-800 px-4 py-1.5 text-[13px]"
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${editing ? 'bg-echo-idle text-eclipse' : 'bg-blurple-500 text-white'}`}>
                {editing ? <Pencil size={11} /> : <CornerUpLeft size={11} />}
              </span>
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

        {/* ── Input area ── */}
        <div className="px-3 pb-6 pt-1 md:pb-4">
          <div className="echo-glass flex items-center gap-2 rounded-2xl px-1 transition-shadow focus-within:ring-2 focus-within:ring-blurple-500/50">
            <FilePickerMenu onPick={handleFilePick} disabled={!!previewFile || sendingFile} uploading={sendingFile} />

            <Tooltip content={t('poll.create')} placement="top">
              <Button
                isIconOnly
                variant="ghost"
                onPress={() => setShowPollModal(true)}
                className="flex h-9 w-9 min-w-0 shrink-0 items-center justify-center rounded-md text-ink-200 transition-colors hover:bg-ink-750 hover:text-foreground"
              >
                <BarChart3 size={18} />
              </Button>
            </Tooltip>

            <Input
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
              className="flex-1 border-none bg-transparent shadow-none outline-none text-[15px] placeholder:text-ink-200"
            />

            <EmojiPicker
              onPick={(emoji) => {
                setInput((v) => v + emoji);
                inputRef.current?.focus();
              }}
            />

            <SendButton
              onPress={handleSend}
              isDisabled={!(input ?? '').trim()}
              label={t('chat.send')}
            />
          </div>

          {/* Typing indicator under input */}
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
                  <span><strong className="text-foreground">{typingNames[0]}</strong> {typingNames.length === 1 ? 'está escribiendo…' : `y ${typingNames.length - 1} más están escribiendo…`}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        </div>

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

        {/* ── Drag & drop overlay ── */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-blurple-400 bg-ink-900/70 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.92, y: 6 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96 }}
                transition={{ duration: 0.18, ease: SPRING_OUT }}
                className="flex flex-col items-center gap-3 px-10 py-8 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blurple-500/20">
                  <Upload size={26} className="text-blurple-400" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{t('chat.dropFiles')}</p>
                  <p className="mt-0.5 text-[13px] text-ink-100">{t('chat.dropFilesHint')}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
