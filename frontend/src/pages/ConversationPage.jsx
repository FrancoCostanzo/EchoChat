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
  AtSign,
  Smile,
  Reply,
  Pencil,
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
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import ImageViewer from '@/components/ImageViewer';
import PdfPreview from '@/components/PdfPreview';
import SendButton from '@/components/SendButton';
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
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((p) => !p)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground disabled:opacity-40"
        >
          {uploading ? <Loader size={18} className="animate-spin" /> : <Paperclip size={18} />}
        </button>
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
              <button
                key={label}
                onClick={() => pick(ref)}
                className="flex w-full items-center gap-3 px-3 py-2 text-[14px] text-ink-50 transition-colors hover:bg-blurple-500 hover:text-white"
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
        <button
          onClick={onCancel}
          disabled={sending}
          className="ml-2 shrink-0 rounded-md p-1 text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground disabled:opacity-40"
        >
          <X size={15} />
        </button>
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
            <button
              onClick={(e) => { e.stopPropagation(); downloadBlob(url, attachment.original_filename); }}
              className="rounded-md bg-black/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/90"
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
      <div className="group relative overflow-hidden rounded-lg bg-black">
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-80 max-w-[min(400px,70vw)] rounded-lg"
        />
        <button
          onClick={() => downloadBlob(url, attachment.original_filename)}
          className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/90 group-hover:opacity-100"
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
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[12px] font-medium leading-none transition-colors',
        mine
          ? 'border-blurple-500/60 bg-blurple-500/15 text-blurple-400 hover:border-blurple-500'
          : 'border-ink-400/40 bg-ink-800 text-ink-50 hover:border-ink-300 hover:bg-ink-750',
      ].join(' ')}
    >
      <span className="text-[14px]">{emoji}</span>
      <span>{count}</span>
    </button>
  );
}

function ReceiptIcon({ message, t }) {
  if (message._status === 'sending') return <Loader size={12} className="animate-spin text-ink-200" />;
  if (message._status === 'error')   return <AlertCircle size={12} className="text-echo-dnd" />;
  if (message.read_count > 0)        return <CheckCheck size={12} className="text-blurple-400" />;
  if (message.delivered_count > 0)   return <CheckCheck size={12} className="text-ink-200" />;
  return <Check size={12} className="text-ink-300" />;
}

const MessageRow = memo(function MessageRow({ message, isOwn, isDirect, isFirstInGroup, isLastInGroup, onEdit, onDelete, onReply, onReact, onRetry, currentUserId, currentUser }) {
  const { t } = useTranslation();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isPending = message._status === 'sending' || message._status === 'error';
  const canEdit = isOwn && (message.type !== 'media' || message.body);

  const displayName = isOwn
    ? (currentUser?.display_name || message.sender_display_name || 'Tú')
    : message.sender_display_name;
  const avatarUrl = isOwn
    ? currentUser?.avatar_url
    : message.sender_avatar_url;

  const showToolbar = !isPending && !message.is_deleted && (isHovered || showEmojiPicker);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={[
        'echo-msg-row group relative flex gap-3 pl-3 pr-12 transition-colors hover:bg-ink-800/50',
        isFirstInGroup ? 'mt-4 pt-1 pb-0.5' : 'py-0.5',
      ].join(' ')}
    >
      {/* Left column: avatar (first-in-group) or hover timestamp */}
      <div className="w-10 shrink-0 select-none">
        {isFirstInGroup ? (
          <UserAvatar
            user={{ display_name: displayName, avatar_url: avatarUrl }}
            size="md"
            className="mt-0.5"
          />
        ) : (
          <span className="mt-1 hidden text-[10px] leading-none text-ink-200 group-hover:block text-right pr-1">
            {formatMessageTime(message.sent_at)}
          </span>
        )}
      </div>

      {/* Right column: message content */}
      <div className="min-w-0 flex-1">
        {/* Sender header (only on first in group) */}
        {isFirstInGroup && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className={[
              'text-[15px] font-semibold leading-none',
              isOwn ? 'text-blurple-300' : 'text-foreground',
            ].join(' ')}>
              {displayName}
            </span>
            <span className="text-[11px] text-ink-200" title={formatFullTime(message.sent_at)}>
              {formatMessageTime(message.sent_at)}
            </span>
            {message.is_edited && (
              <span className="text-[10px] text-ink-200">({t('chat.edited')})</span>
            )}
          </div>
        )}

        {/* Reply preview */}
        {message.reply_to_id && (message.reply_to_body || message.reply_to_type) && (
          <div className="relative mb-1 flex items-center gap-2 pl-2 text-[13px] text-ink-100">
            <span className="absolute left-0 top-1/2 -ml-6 h-[18px] w-[26px] rounded-tl-[8px] border-l-2 border-t-2 border-ink-300/60" />
            <Reply size={11} className="shrink-0 text-ink-200" />
            {message.reply_to_sender && (
              <span className="truncate font-semibold text-blurple-400">
                @{message.reply_to_sender}
              </span>
            )}
            <span className="truncate text-ink-100/80">
              {message.reply_to_type === 'media'
                ? <span className="inline-flex items-center gap-1"><Paperclip size={11} />{t('chat.attachedFile')}</span>
                : message.reply_to_body}
            </span>
          </div>
        )}

        {/* Deleted */}
        {message.is_deleted ? (
          <div className="flex items-center gap-1.5 text-[14px] italic text-ink-200">
            <Trash2 size={13} className="shrink-0 opacity-60" />
            <span>{t('chat.messageDeleted')}</span>
          </div>
        ) : (
          <>
            {/* Body */}
            {message.type !== 'media' && message.body && (
              <p className={[
                'wrap-break-word whitespace-pre-wrap text-[15px] leading-[1.375] text-ink-0',
                message._status === 'sending' ? 'opacity-60' : '',
                message._status === 'error' ? 'text-echo-dnd' : '',
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
              <div className="mt-1 flex items-center gap-2 rounded-md border border-ink-400/40 bg-ink-800 px-3 py-2 text-xs">
                <Loader size={13} className="animate-spin shrink-0 text-blurple-400" />
                <span className="max-w-64 truncate text-ink-100">{message._filename || t('chat.uploadingFile')}</span>
              </div>
            )}

            {/* Status line for own messages */}
            {isOwn && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-200">
                <ReceiptIcon message={message} t={t} />
                {message._status === 'error' && (
                  <button
                    onClick={() => onRetry(message.id)}
                    className="flex items-center gap-1 text-echo-dnd hover:underline"
                  >
                    <RefreshCw size={10} />
                    {t('chat.retrySend')}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Reactions */}
        {!message.is_deleted && message.reactions?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
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
              onClick={() => setShowEmojiPicker((p) => !p)}
              className="flex items-center rounded-md border border-ink-400/40 bg-ink-800 px-1.5 py-0.5 text-ink-200 transition-colors hover:border-ink-300 hover:bg-ink-750 hover:text-foreground"
              title={t('chat.react')}
            >
              <Smile size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Toolbar (top-right, Discord-style) */}
      {!isPending && !message.is_deleted && (
        <div className="echo-msg-toolbar" data-show={showToolbar}>
          <div className="relative">
            <Tooltip content={t('chat.react')} placement="top">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((p) => !p)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
              >
                <Smile size={16} />
              </button>
            </Tooltip>
            <AnimatePresence>
              {showEmojiPicker && (
                <>
                  {/* Backdrop to catch outside clicks */}
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowEmojiPicker(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="absolute bottom-9 right-0 z-30 flex gap-0.5 rounded-lg border border-ink-400/40 bg-ink-850 p-1 shadow-xl"
                  >
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReact(message.id, emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="rounded-md p-1 text-base transition-transform hover:scale-125 hover:bg-ink-750"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <Tooltip content={t('chat.reply')} placement="top">
            <button
              type="button"
              onClick={() => onReply(message)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
            >
              <Reply size={16} />
            </button>
          </Tooltip>

          {canEdit && (
            <Tooltip content={t('common.edit')} placement="top">
              <button
                type="button"
                onClick={() => onEdit(message)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
              >
                <Pencil size={16} />
              </button>
            </Tooltip>
          )}
          {isOwn && (
            <Tooltip content={t('common.delete')} placement="top">
              <button
                type="button"
                onClick={() => onDelete(message)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-echo-dnd/20 hover:text-echo-dnd"
              >
                <Trash2 size={16} />
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </motion.div>
  );
});

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
  const [deleteTarget, setDeleteTarget] = useState(null); // message object to confirm delete
  const [previewFile, setPreviewFile] = useState(null);
  const [sendingFile, setSendingFile] = useState(false);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevScrollHeightRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const wasAtBottomRef = useRef(true);
  const initialLoadRef = useRef(false); // true after first batch of messages is rendered
  const scrollIdleTimerRef = useRef(null);

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
          onRetry={retrySendMessage}
          currentUserId={user?.id}
          currentUser={user}
        />
      );
    });
  }, [messages, user, conversation?.type, handleEdit, handleDeleteRequest, handleReply, handleReact, retrySendMessage]);

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

      <div className="flex h-full flex-col bg-ink-700">
        {/* ── Header (Discord-style) ── */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-black/30 bg-ink-700 px-3 shadow-[0_1px_0_rgba(0,0,0,0.2)] md:px-4">
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
            <Tooltip content={t('common.search')} placement="bottom">
              <Button isIconOnly size="sm" variant="ghost" className="hidden h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground sm:flex">
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
        <div className="relative flex-1 min-h-0 bg-ink-700">
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
                <button
                  onClick={() => {
                    loadingMoreRef.current = true;
                    prevScrollHeightRef.current = containerRef.current?.scrollHeight ?? null;
                    loadMoreMessages();
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-ink-400/40 bg-ink-800 px-3 py-1 text-xs text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
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

            {/* Conversation welcome when we hit the top */}
            {!hasMoreMessages && !loadingMessages && messages.length > 0 && (
              <div className="mb-4 px-4 pt-6">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-ink-600">
                  {isDirect
                    ? <AtSign size={32} className="text-ink-100" />
                    : <Hash size={32} strokeWidth={2} className="text-ink-100" />}
                </div>
                <h3 className="text-2xl font-extrabold">
                  {isDirect ? convName : `Bienvenido a #${convName}`}
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
                className="absolute bottom-4 right-6 flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-ink-100 shadow-lg ring-1 ring-black/20 transition-all hover:bg-ink-600 hover:text-foreground"
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
              <button
                onClick={cancelAction}
                className="rounded-full p-1 text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
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

        {/* ── Input area (Discord-style) ── */}
        <div className="bg-ink-700 px-3 pb-6 pt-1 md:pb-4">
          <div className="flex items-center gap-2 rounded-lg bg-ink-600 px-1 transition-shadow focus-within:ring-1 focus-within:ring-blurple-500/40">
            <FilePickerMenu onPick={handleFilePick} disabled={!!previewFile || sendingFile} uploading={sendingFile} />

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
              className="flex-1 border-none bg-transparent shadow-none outline-none text-[15px] placeholder:text-ink-200"
            />

            <Tooltip content={t('chat.react')} placement="top">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-750 hover:text-foreground"
                onPress={() => {}}
              >
                <Smile size={18} />
              </Button>
            </Tooltip>

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
    </>
  );
}
