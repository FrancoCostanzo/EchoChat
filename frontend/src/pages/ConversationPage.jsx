import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Dropdown, Label, Spinner, Tooltip } from '@heroui/react';
import {
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Search,
  Pin,
  Smile,
  Reply,
  Pencil,
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
  AlertTriangle,
  Loader,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Film,
  FileText,
  Send,
  AtSign,
  Gift,
  Sticker,
  PlusCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import ImageViewer from '@/components/ImageViewer';
import PdfPreview from '@/components/PdfPreview';
import { formatMessageTime, formatFullTime } from '@/lib/dates';
import { storageApi } from '@/lib/endpoints';

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
    { icon: ImageIcon, label: t('chat.attachImage'),    ref: imageRef, accept: 'image/*' },
    { icon: Film,      label: t('chat.attachVideo'),    ref: videoRef, accept: 'video/*' },
    { icon: FileText,  label: t('chat.attachDocument'), ref: docRef,   accept: '*/*' },
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

      <Tooltip content={t('chat.attachFile')}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((p) => !p)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/70 text-background transition-all hover:bg-foreground disabled:opacity-40"
          aria-label={t('chat.attachFile')}
        >
          {uploading ? <Loader size={14} className="animate-spin" /> : <PlusCircle size={20} strokeWidth={2} className="absolute" />}
        </button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute bottom-10 left-0 z-30 min-w-44 overflow-hidden rounded-lg border border-separator bg-surface-secondary shadow-xl"
          >
            {MENU_ITEMS.map(({ icon: Icon, label, ref }) => (
              <button
                key={label}
                onClick={() => pick(ref)}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </button>
            ))}
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
      transition={{ duration: 0.18, ease: SPRING_OUT }}
      className="border-t border-separator bg-surface-secondary"
    >
      <div className="flex items-center justify-between border-b border-separator/60 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {isImage
            ? <ImageIcon size={14} className="shrink-0 text-accent" />
            : isVideo
              ? <Film size={14} className="shrink-0 text-accent" />
              : <FileText size={14} className="shrink-0 text-accent" />}
          <span className="truncate text-sm font-medium">{file.name}</span>
          <span className="shrink-0 text-xs text-muted">{formatSize(file.size)}</span>
        </div>
        <button
          onClick={onCancel}
          disabled={sending}
          className="ml-2 shrink-0 rounded p-1 text-muted transition-colors hover:bg-default hover:text-foreground disabled:opacity-40"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex max-h-60 items-center justify-center overflow-hidden bg-surface-tertiary px-4 py-3">
        {isImage && (
          <img
            src={objectUrl}
            alt={file.name}
            className="max-h-52 max-w-full rounded-md object-contain shadow-md"
          />
        )}
        {isVideo && (
          <video
            src={objectUrl}
            controls
            className="max-h-52 max-w-full rounded-md shadow-md"
          />
        )}
        {!isImage && !isVideo && (
          <div className="flex items-center gap-4 py-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent-soft">
              <FileText size={24} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="max-w-xs truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted">{formatSize(file.size)}</p>
            </div>
          </div>
        )}
      </div>

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
          className="flex-1 bg-default"
        />
        <Button
          isIconOnly
          isDisabled={sending}
          className="shrink-0 rounded-md bg-accent text-accent-foreground hover:bg-accent/90"
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
    <div className="flex items-center gap-0.5 text-muted">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 1.1,
            ease: 'easeInOut',
            repeat: Number.POSITIVE_INFINITY,
            delay: index * 0.18,
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
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.16, ease: EASE_OUT }}
        className="relative z-10 mx-4 w-full max-w-sm overflow-hidden rounded-md border border-separator bg-surface shadow-2xl"
      >
        <div className="p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft">
              <AlertTriangle size={18} className="text-danger" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{t('chat.deleteMessage')}</h3>
              <p className="mt-0.5 text-xs text-muted">
                {t('chat.deleteMessageWarning')}
              </p>
            </div>
          </div>

          {message?.body && message.type !== 'media' && (
            <div className="mb-5 rounded-md border border-separator bg-surface-secondary px-3 py-2.5 text-sm text-muted line-clamp-3">
              "{message.body}"
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onPress={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              className="bg-danger text-white hover:bg-danger/90"
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
        className={`animate-pulse rounded-md bg-default/60 ${
          isImage || isVideo || isPdf ? 'h-48 w-[280px]' : 'h-9 w-44'
        }`}
      />
    );
  }

  if (isImage) {
    return (
      <>
        <div
          className="group relative inline-block cursor-zoom-in overflow-hidden rounded-md"
          onClick={() => setViewerOpen(true)}
        >
          <img
            src={url}
            alt={attachment.original_filename}
            className="max-h-80 max-w-[70vw] rounded-md sm:max-w-sm"
          />
          <div className="absolute inset-0 flex items-end justify-end gap-1 bg-linear-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); downloadBlob(url, attachment.original_filename); }}
              className="rounded-md bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
              title={t('common.download')}
            >
              <Download size={13} />
            </button>
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
      <div className="group relative overflow-hidden rounded-md bg-black">
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-80 max-w-[70vw] rounded-md sm:max-w-sm"
        />
        <button
          onClick={() => downloadBlob(url, attachment.original_filename)}
          className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/80 group-hover:opacity-100"
          title={t('common.download')}
        >
          <Download size={13} />
        </button>
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
      className="flex max-w-sm items-center gap-2 rounded-md border border-separator bg-surface-secondary px-3 py-2 text-xs transition-colors hover:bg-default"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft">
        <Paperclip size={14} className="text-accent" />
      </div>
      <span className="max-w-40 truncate font-medium">{attachment.original_filename}</span>
      <Download size={12} className="ml-auto shrink-0 opacity-60" />
    </a>
  );
}

/* ─────────────────────────── Discord-style Message Row ─────────────────────────── */
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Deterministic accent hue per-username so group chats feel "Discord-colored"
const USER_HUES = [210, 160, 330, 40, 280, 120, 0, 250, 60, 190];
function userColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `oklch(0.78 0.16 ${USER_HUES[h % USER_HUES.length]})`;
}

const MessageRow = memo(function MessageRow({
  message, isOwn, isDirect, isFirstInGroup, isLastInGroup,
  onEdit, onDelete, onReply, onReact, onRetry,
}) {
  const { t } = useTranslation();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const status = message._status;
  const isDeleted = message.is_deleted;
  const senderName = message.sender_display_name;
  const nameColor = !isDirect && !isOwn ? userColor(senderName) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className={`msg-row hover-row group relative flex gap-3 px-4 ${
        isFirstInGroup ? 'mt-4 pt-1 pb-0.5' : 'py-0.5'
      }`}
    >
      {/* Avatar (only on first of group) */}
      <div className="w-10 shrink-0">
        {isFirstInGroup ? (
          <UserAvatar
            user={{
              display_name: senderName,
              avatar_url: message.sender_avatar_url,
            }}
            size="md"
            className="mt-0.5"
          />
        ) : (
          <span
            className="msg-timestamp-inline block w-10 pt-1 text-center text-[10px] leading-none text-muted opacity-0 transition-opacity"
            title={formatFullTime(message.sent_at)}
          >
            {formatMessageTime(message.sent_at)}
          </span>
        )}
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        {/* Header: sender + time (first of group only) */}
        {isFirstInGroup && (
          <div className="flex items-baseline gap-2 leading-none">
            <span
              className="truncate text-[15px] font-semibold"
              style={nameColor ? { color: nameColor } : undefined}
            >
              {isOwn ? t('chat.you', { defaultValue: senderName }) : senderName}
            </span>
            <span
              className="shrink-0 text-[11px] text-muted"
              title={formatFullTime(message.sent_at)}
            >
              {formatMessageTime(message.sent_at)}
            </span>
          </div>
        )}

        {/* Reply preview */}
        {!isDeleted && message.reply_to_id && (message.reply_to_body || message.reply_to_type) && (
          <div className="mb-0.5 flex items-center gap-1.5 text-xs">
            <span className="inline-block h-3 w-4 -translate-y-0.5 border-l-2 border-t-2 border-muted/50 rounded-tl-md" />
            {message.reply_to_sender && (
              <span className="font-semibold" style={{ color: userColor(message.reply_to_sender) }}>
                @{message.reply_to_sender}
              </span>
            )}
            <span className="truncate text-muted">
              {message.reply_to_type === 'media' ? (
                <span className="inline-flex items-center gap-1"><Paperclip size={11} />{t('chat.attachedFile')}</span>
              ) : (
                message.reply_to_body
              )}
            </span>
          </div>
        )}

        {/* Body */}
        {isDeleted ? (
          <p className="flex items-center gap-1.5 py-0.5 text-[14px] italic text-muted">
            <Trash2 size={13} className="shrink-0 opacity-60" />
            {t('chat.messageDeleted')}
          </p>
        ) : (
          <>
            {message.type !== 'media' && message.body && (
              <p
                className={`wrap-break-word whitespace-pre-wrap text-[15px] leading-[1.375] text-foreground ${
                  status === 'sending' ? 'opacity-70' : ''
                } ${status === 'error' ? 'text-danger' : ''}`}
              >
                {message.body}
                {message.is_edited && (
                  <span className="ml-1 text-[10px] text-muted">({t('chat.edited')})</span>
                )}
              </p>
            )}

            {/* Attachments */}
            {message.attachments?.length > 0 && (
              <div className={`flex flex-col gap-1.5 ${message.body && message.type !== 'media' ? 'mt-1.5' : 'mt-0.5'}`}>
                {message.attachments.map((att) => (
                  <AttachmentView key={att.id} attachment={att} />
                ))}
              </div>
            )}

            {/* Caption for media messages (shown after attachment) */}
            {message.type === 'media' && message.body && message.attachments?.length > 0 && (
              <p className={`mt-1 wrap-break-word whitespace-pre-wrap text-[14px] leading-[1.375] text-foreground ${
                status === 'sending' ? 'opacity-70' : ''
              }`}>
                {message.body}
                {message.is_edited && (
                  <span className="ml-1 text-[10px] text-muted">({t('chat.edited')})</span>
                )}
              </p>
            )}

            {/* Pending attachment placeholder */}
            {message.type === 'media' && (!message.attachments || message.attachments.length === 0) && status === 'sending' && (
              <div className="mt-0.5 flex max-w-sm items-center gap-2 rounded-md border border-separator bg-surface-secondary px-3 py-2 text-xs">
                <Loader size={13} className="animate-spin shrink-0 text-accent" />
                <span className="max-w-40 truncate opacity-70">{message._filename || t('chat.uploadingFile')}</span>
              </div>
            )}
          </>
        )}

        {/* Status row (own messages) */}
        {isOwn && !isDeleted && status && (status === 'sending' || status === 'error') && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            {status === 'sending' && <><Loader size={11} className="animate-spin" /> {t('chat.sending', { defaultValue: '' })}</>}
            {status === 'error' && (
              <>
                <AlertCircle size={11} className="text-danger" />
                <button onClick={() => onRetry(message.id)} className="text-danger hover:underline">
                  <span className="inline-flex items-center gap-0.5"><RefreshCw size={10} />{t('chat.retrySend')}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Read receipts (own, last of group) */}
        {isOwn && !isDeleted && isLastInGroup && status !== 'sending' && status !== 'error' && (
          <div className="mt-0.5 flex items-center gap-0.5 text-[11px] text-muted">
            {message.read_count > 0 ? (
              <CheckCheck size={13} className="text-accent" />
            ) : message.delivered_count > 0 ? (
              <CheckCheck size={13} className="opacity-60" />
            ) : (
              <Check size={13} className="opacity-60" />
            )}
          </div>
        )}

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r, i) => (
              <button
                key={i}
                onClick={() => onReact(message.id, r.emoji)}
                className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition-all hover:bg-accent-soft ${
                  r.reacted
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-separator bg-surface-secondary text-muted'
                }`}
              >
                <span className="text-[13px] leading-none">{r.emoji}</span>
                <span className="font-semibold tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover action bar (top-right floating) */}
      {!isDeleted && status !== 'sending' && (
        <div className="msg-actions absolute -top-3 right-4 z-10 flex items-center gap-0.5 rounded-md border border-separator bg-surface shadow-md">
          {/* Emoji */}
          <div className="relative">
            <Tooltip content={t('chat.react')}>
              <button
                onClick={() => setShowEmojiPicker((p) => !p)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-default hover:text-foreground"
              >
                <Smile size={16} />
              </button>
            </Tooltip>
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="absolute bottom-9 right-0 z-20 flex gap-0.5 rounded-md border border-separator bg-surface px-1.5 py-1 shadow-xl"
                  onMouseLeave={() => setShowEmojiPicker(false)}
                >
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { onReact(message.id, emoji); setShowEmojiPicker(false); }}
                      className="rounded-md px-1.5 py-1 text-base transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Tooltip content={t('chat.reply')}>
            <button
              onClick={() => onReply(message)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-default hover:text-foreground"
            >
              <Reply size={16} />
            </button>
          </Tooltip>

          {isOwn && (message.type !== 'media' || message.body) && (
            <Tooltip content={t('common.edit')}>
              <button
                onClick={() => onEdit(message)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-default hover:text-foreground"
              >
                <Pencil size={15} />
              </button>
            </Tooltip>
          )}

          {isOwn && (
            <Tooltip content={t('common.delete')}>
              <button
                onClick={() => onDelete(message)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </motion.div>
  );
});

/* ─────────────────────────── Conversation Page ─────────────────────────── */
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
  } = useChatStore();

  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [sendingFile, setSendingFile] = useState(false);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevScrollHeightRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const wasAtBottomRef = useRef(true);
  const initialLoadRef = useRef(false);
  const scrollIdleTimerRef = useRef(null);

  const conversation = getActiveConversation();

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

  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null) return;
    if (loadingMoreRef.current) return;
    const el = containerRef.current;
    if (!el || messages.length === 0) return;
    if (!initialLoadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
      wasAtBottomRef.current = true;
      initialLoadRef.current = true;
    } else if (wasAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  const messageElements = useMemo(() => {
    const isDirect = conversation?.type === 'direct';
    const GROUP_GAP_MS = 7 * 60 * 1000; // start a new group after 7 minutes of silence
    return messages.map((msg, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];

      const prevTime = prev ? new Date(prev.sent_at).getTime() : 0;
      const currTime = new Date(msg.sent_at).getTime();
      const nextTime = next ? new Date(next.sent_at).getTime() : Infinity;

      const isFirstInGroup =
        !prev ||
        prev.sender_id !== msg.sender_id ||
        currTime - prevTime > GROUP_GAP_MS ||
        prev.is_deleted !== msg.is_deleted;

      const isLastInGroup =
        !next ||
        next.sender_id !== msg.sender_id ||
        nextTime - currTime > GROUP_GAP_MS;

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
          onRetry={retrySendMessage}
        />
      );
    });
  }, [messages, user?.id, conversation?.type, handleEdit, handleDeleteRequest, handleReply, handleReact, retrySendMessage]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const convName = conversation.display_name || conversation.name || t('chat.conversation');
  const isDirect = conversation.type === 'direct';

  const inputPlaceholder = isDirect
    ? t('chat.messageDirect', { name: convName, defaultValue: t('chat.writeMessage') })
    : t('chat.messageGroup', { name: convName, defaultValue: t('chat.writeMessage') });

  return (
    <>
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDeleteModal
            message={deleteTarget}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
          />
        )}
      </AnimatePresence>

      <div className="flex h-full flex-col bg-background">
        {/* ── Header (Discord-style, 48px) ── */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-separator px-3 shadow-[0_1px_0_0_rgba(0,0,0,0.2)] md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="md:hidden shrink-0"
              onPress={() => navigate('/chat')}
            >
              <ArrowLeft size={18} />
            </Button>

            {isDirect ? (
              <>
                <UserAvatar
                  user={{
                    display_name: convName,
                    presence: conversation.member_presence,
                    avatar_url: conversation.other_avatar_url,
                  }}
                  size="sm"
                  showStatus
                />
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold leading-tight">{convName}</h2>
                  {conversation.member_presence && (
                    <p className="text-[11px] capitalize leading-tight text-muted">
                      {conversation.member_presence}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                  <Users size={16} className="text-accent" strokeWidth={2} />
                </div>
                <h2 className="truncate text-[15px] font-semibold leading-tight">
                  {convName}
                </h2>
                {conversation.member_count && (
                  <>
                    <span className="h-5 w-px shrink-0 bg-separator" />
                    <p className="shrink-0 text-[12px] text-muted">
                      {conversation.member_count} {t('chat.members')}
                    </p>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip content={t('chat.voiceCall')}>
              <Button isIconOnly size="sm" variant="ghost" className="hidden rounded-md text-muted hover:text-foreground sm:flex">
                <Phone size={18} />
              </Button>
            </Tooltip>
            <Tooltip content={t('chat.videoCall')}>
              <Button isIconOnly size="sm" variant="ghost" className="hidden rounded-md text-muted hover:text-foreground sm:flex">
                <Video size={18} />
              </Button>
            </Tooltip>
            <Tooltip content={t('chat.pinnedMessages')}>
              <Button isIconOnly size="sm" variant="ghost" className="hidden rounded-md text-muted hover:text-foreground sm:flex">
                <Pin size={18} />
              </Button>
            </Tooltip>
            <Tooltip content={t('common.search')}>
              <Button isIconOnly size="sm" variant="ghost" className="hidden rounded-md text-muted hover:text-foreground sm:flex">
                <Search size={18} />
              </Button>
            </Tooltip>
            <Dropdown>
              <Button isIconOnly size="sm" variant="ghost" className="rounded-md text-muted hover:text-foreground">
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
        </header>

        {/* ── Messages ── */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto overflow-x-hidden py-3"
          >
            {loadingMessages && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted">
                <Spinner size="lg" />
                <p className="text-xs">{t('chat.loadingMessages')}</p>
              </div>
            )}

            {/* Welcome banner at top when all history is loaded */}
            {!hasMoreMessages && !loadingMessages && messages.length > 0 && (
              <div className="px-4 pt-4 pb-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
                  {isDirect ? (
                    <UserAvatar
                      user={{
                        display_name: convName,
                        avatar_url: conversation.other_avatar_url,
                      }}
                      size="lg"
                    />
                  ) : (
                    <Users size={32} className="text-accent" strokeWidth={2} />
                  )}
                </div>
                <h3 className="mt-4 text-2xl font-bold">
                  {isDirect ? convName : `${t('chat.welcomeGroup', { defaultValue: 'Bienvenido al grupo' })} ${convName}`}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {isDirect
                    ? t('chat.directStart', { name: convName, defaultValue: `Este es el inicio de tu historial con ${convName}.` })
                    : t('chat.groupStart', { name: convName, defaultValue: `Este es el comienzo del grupo ${convName}.` })}
                </p>
              </div>
            )}

            {hasMoreMessages && !loadingMessages && (
              <div className="flex justify-center py-2">
                <button
                  onClick={() => {
                    loadingMoreRef.current = true;
                    prevScrollHeightRef.current = containerRef.current?.scrollHeight ?? null;
                    loadMoreMessages();
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-separator bg-surface-secondary px-3 py-1 text-xs text-muted shadow-sm transition-colors hover:bg-default hover:text-foreground"
                >
                  <ArrowUp size={12} />
                  {t('chat.loadMore')}
                </button>
              </div>
            )}

            {loadingMessages && messages.length > 0 && (
              <div className="flex justify-center py-3">
                <Spinner size="sm" />
              </div>
            )}

            {messageElements}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-secondary text-foreground shadow-lg ring-1 ring-separator transition-all hover:bg-default"
              >
                <ArrowDown size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ── Typing indicator ── */}
        <AnimatePresence initial={false}>
          {typingText && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 24 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-0.5">
                <TypingDots />
                <p className="text-[11px] text-muted">{typingText}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Reply / Edit banner ── */}
        <AnimatePresence initial={false}>
          {(replyTo || editing) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="mx-3 mt-2 flex items-center gap-3 rounded-t-md border-t border-x border-separator bg-surface-secondary px-3 py-1.5 md:mx-4"
            >
              <span className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${editing ? 'text-warning' : 'text-muted'}`}>
                {editing ? <Pencil size={11} /> : <CornerUpLeft size={11} />}
                {editing ? t('chat.editingMessage') : (
                  <>
                    {t('chat.replyingTo', { name: '' })}
                    <span className="font-semibold normal-case" style={{ color: userColor(replyTo.sender_display_name) }}>
                      @{replyTo.sender_display_name}
                    </span>
                  </>
                )}
              </span>
              <p className="min-w-0 flex-1 truncate text-xs text-muted">
                {editing ? editing.body : (replyTo.body || (replyTo.type === 'media' ? t('chat.attachedFile') : ''))}
              </p>
              <button
                onClick={cancelAction}
                className="rounded-full p-1 text-muted transition-colors hover:bg-default hover:text-foreground"
                aria-label={t('common.cancel')}
              >
                <X size={14} />
              </button>
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

        {/* ── Input (Discord-style) ── */}
        <div className="px-3 pb-4 pt-1 md:px-4">
          <div
            className={`flex items-end gap-2 rounded-md bg-default px-3 py-2 transition-shadow focus-within:ring-2 focus-within:ring-accent/40 ${
              (replyTo || editing) ? 'rounded-t-none' : ''
            }`}
          >
            <div className="flex h-9 items-center">
              <FilePickerMenu
                onPick={handleFilePick}
                disabled={!!previewFile || sendingFile}
                uploading={sendingFile}
              />
            </div>

            <Input
              ref={inputRef}
              placeholder={inputPlaceholder}
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
              className="flex-1 border-none bg-transparent text-[15px] shadow-none outline-none"
            />

            <div className="flex h-9 shrink-0 items-center gap-1 text-muted">
              <Tooltip content="GIF">
                <button className="flex h-7 w-7 items-center justify-center rounded hover:text-foreground" type="button">
                  <Gift size={20} />
                </button>
              </Tooltip>
              <Tooltip content="Sticker">
                <button className="flex h-7 w-7 items-center justify-center rounded hover:text-foreground" type="button">
                  <Sticker size={20} />
                </button>
              </Tooltip>
              <Tooltip content={t('chat.send')}>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!(input ?? '').trim()}
                  className="flex h-7 w-7 items-center justify-center rounded text-accent transition-all hover:text-accent disabled:text-muted disabled:opacity-50 disabled:hover:text-muted"
                >
                  <Send size={20} />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
