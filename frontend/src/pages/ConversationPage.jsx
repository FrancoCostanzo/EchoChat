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
  ArrowDown,
  ArrowLeft,
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

      <Tooltip content={t('chat.attachFile')}>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          isDisabled={disabled}
          className="mb-0.5 shrink-0 rounded-xl text-muted hover:text-foreground"
          onPress={() => setOpen((p) => !p)}
        >
          {uploading ? <Loader size={17} className="animate-spin" /> : <Paperclip size={17} />}
        </Button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute bottom-10 left-0 z-30 min-w-44 overflow-hidden rounded-2xl border border-separator bg-background shadow-xl"
          >
            {MENU_ITEMS.map(({ icon: Icon, label, ref }) => (
              <button
                key={label}
                onClick={() => pick(ref)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-default"
              >
                <Icon size={16} className="shrink-0 text-accent" />
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
      className="border-t border-separator bg-background"
    >
      {/* Header: icon + filename + size + cancel */}
      <div className="flex items-center justify-between border-b border-separator/50 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {isImage
            ? <Image size={14} className="shrink-0 text-accent" />
            : isVideo
              ? <Film size={14} className="shrink-0 text-accent" />
              : <FileText size={14} className="shrink-0 text-accent" />}
          <span className="truncate text-sm font-medium">{file.name}</span>
          <span className="shrink-0 text-xs text-muted">{formatSize(file.size)}</span>
        </div>
        <button
          onClick={onCancel}
          disabled={sending}
          className="ml-2 shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-default hover:text-foreground disabled:opacity-40"
        >
          <X size={15} />
        </button>
      </div>

      {/* Preview area */}
      <div className="flex max-h-60 items-center justify-center overflow-hidden bg-black/5 px-4 py-3">
        {isImage && (
            <img
              src={objectUrl}
              alt={file.name}
              className="max-h-52 max-w-full rounded-xl object-contain shadow-md"
            />
          )}
          {isVideo && (
            <video
              src={objectUrl}
              controls
              className="max-h-52 max-w-full rounded-xl shadow-md"
            />
          )}
          {!isImage && !isVideo && (
            <div className="flex items-center gap-4 py-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft">
                <FileText size={28} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="max-w-xs truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted">{formatSize(file.size)}</p>
              </div>
            </div>
          )}
      </div>

      {/* Caption input + send */}
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
            className="flex-1 border-separator/70 bg-default"
          />
          <Button
            isIconOnly
            isDisabled={sending}
            className="shrink-0 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
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
          animate={{ y: [0, -5, 0] }}
          transition={{
            duration: 1.2,
            ease: 'easeInOut',
            repeat: Number.POSITIVE_INFINITY,
            delay: index * 0.2,
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
        className="relative z-10 mx-4 w-full max-w-sm rounded-2xl border border-separator bg-background shadow-2xl"
      >
        <div className="p-6">
          {/* Icon + title */}
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft">
              <AlertTriangle size={18} className="text-danger" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('chat.deleteMessage')}</h3>
              <p className="mt-0.5 text-xs text-muted">
                {t('chat.deleteMessageWarning')}
              </p>
            </div>
          </div>

          {/* Message preview */}
          {message?.body && message.type !== 'media' && (
            <div className="mb-5 rounded-xl border border-separator bg-default px-3 py-2.5 text-sm text-muted line-clamp-3 italic">
              "{message.body}"
            </div>
          )}

          {/* Actions */}
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
function AttachmentView({ attachment }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const isImage =
    attachment.object_type === 'image' || attachment.mime_type?.startsWith('image/');
  const isVideo =
    attachment.object_type === 'video' || attachment.mime_type?.startsWith('video/');

  useEffect(() => {
    storageApi.getUrl(attachment.id).then((res) => setUrl(res.data.url)).catch(() => {});
  }, [attachment.id]);

  if (!url) {
    return (
      <div
        className={`animate-pulse rounded-xl bg-default/60 ${
          isImage || isVideo ? 'h-32 w-48' : 'h-9 w-44'
        }`}
      />
    );
  }

  if (isImage) {
    return (
      <>
        <div
          className="group relative inline-block cursor-zoom-in overflow-hidden rounded-xl"
          onClick={() => setViewerOpen(true)}
        >
          <img
            src={url}
            alt={attachment.original_filename}
            className="max-h-64 max-w-[70vw] object-cover transition-transform duration-300 group-hover:scale-[1.02] sm:max-w-xs"
          />
          <div className="absolute inset-0 flex items-end justify-end gap-1 bg-linear-to-t from-black/40 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); downloadBlob(url, attachment.original_filename); }}
              className="rounded-lg bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
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
      <div className="group relative overflow-hidden rounded-xl bg-black">
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-64 max-w-[70vw] rounded-xl sm:max-w-xs"
        />
        <button
          onClick={() => downloadBlob(url, attachment.original_filename)}
          className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/80 group-hover:opacity-100"
          title={t('common.download')}
        >
          <Download size={13} />
        </button>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-separator/60 bg-background/50 px-3 py-2 text-xs transition-colors hover:bg-default"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
        <Paperclip size={13} className="text-accent" />
      </div>
      <span className="max-w-40 truncate font-medium">{attachment.original_filename}</span>
      <Download size={11} className="ml-auto shrink-0 opacity-50" />
    </a>
  );
}

/* ─────────────────────────── Message Bubble ─────────────────────────── */
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const MessageBubble = memo(function MessageBubble({ message, isOwn, isDirect, isFirstInGroup, isLastInGroup, onEdit, onDelete, onReply, onReact, onRetry }) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: isOwn ? 16 : -16, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`group flex gap-2 px-2 md:px-4 ${isFirstInGroup ? 'pt-3 pb-0.5' : 'py-0.5'} ${isOwn ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar */}
      {!isOwn && !isDirect && (
        isLastInGroup ? (
          <UserAvatar
            user={{ display_name: message.sender_display_name }}
            size="sm"
            className="mt-1 shrink-0 self-end"
          />
        ) : (
          <div className="w-8 shrink-0" />
        )
      )}

      {/* Deleted message */}
      {message.is_deleted ? (
        <div className={`flex max-w-[85%] flex-col md:max-w-[68%] ${isOwn ? 'items-end' : 'items-start'}`}>
          <div className={`flex items-center gap-1.5 rounded-2xl border border-separator/50 px-3.5 py-2 text-sm italic text-muted ${isOwn ? 'rounded-tr-md' : 'rounded-tl-md'}`}>
            <Trash2 size={13} className="shrink-0 opacity-50" />
            <span>{t('chat.messageDeleted')}</span>
          </div>
          <span className="mt-0.5 px-1 text-[10px] text-muted">{formatMessageTime(message.sent_at)}</span>
        </div>
      ) : (<>
      <div className={`max-w-[85%] md:max-w-[68%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender name */}
        {!isOwn && !isDirect && isFirstInGroup && (
          <span className="mb-0.5 ml-1 text-xs font-semibold text-accent">
            {message.sender_display_name}
          </span>
        )}

        {/* Reply preview */}
        {message.reply_to_id && (message.reply_to_body || message.reply_to_type) && (
          <div className={`mb-1 flex max-w-full items-start gap-1.5 rounded-xl border-l-[3px] border-accent bg-accent/10 px-2.5 py-1.5 text-xs ${isOwn ? 'mr-1' : 'ml-1'}`}>
            <Reply size={11} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0">
              {message.reply_to_sender && (
                <span className="block font-semibold text-accent">{message.reply_to_sender}</span>
              )}
              <span className="line-clamp-2 text-muted">
                {message.reply_to_type === 'media' ? '📎 Archivo adjunto' : message.reply_to_body}
              </span>
            </div>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-3.5 py-2.5 text-sm shadow-sm transition-shadow hover:shadow-md ${
            isOwn
              ? `${isLastInGroup ? 'rounded-tr-md' : 'rounded-2xl'} bg-accent text-accent-foreground`
              : `${isLastInGroup ? 'rounded-tl-md' : 'rounded-2xl'} bg-default text-foreground`
          } ${message._status === 'sending' ? 'opacity-75' : ''}`}
        >
          {message.type !== 'media' && message.body && (
            <p className="wrap-break-word whitespace-pre-wrap leading-relaxed">{message.body}</p>
          )}
          {message.attachments?.length > 0 && (
            <div className={`flex flex-col gap-1.5 ${message.type !== 'media' ? 'mt-2' : ''}`}>
              {message.attachments.map((att) => (
                <AttachmentView key={att.id} attachment={att} />
              ))}
            </div>
          )}

          {/* Pending attachment placeholder (optimistic media message) */}
          {message.type === 'media' && (!message.attachments || message.attachments.length === 0) && message._status === 'sending' && (
            <div className="flex items-center gap-2 rounded-xl border border-separator/60 bg-background/50 px-3 py-2 text-xs">
              <Loader size={13} className="animate-spin shrink-0 text-accent" />
              <span className="max-w-40 truncate opacity-70">{message._filename || t('chat.uploadingFile')}</span>
            </div>
          )}

          {/* Time + status */}
          <div
            className={`mt-1.5 flex items-center gap-1 text-[10px] leading-none ${
              isOwn ? 'justify-end text-accent-foreground/60' : 'text-muted'
            }`}
          >
            {message.is_edited && (
              <span className="opacity-70">{t('chat.edited')}</span>
            )}
            <span>{formatMessageTime(message.sent_at)}</span>
            {isOwn && (
              message._status === 'sending' ? (
                <Loader size={13} className="animate-spin opacity-60" />
              ) : message._status === 'error' ? (
                <AlertCircle size={13} className="text-danger" />
              ) : message.read_count > 0 ? (
                <CheckCheck size={13} className="text-blue-300" />
              ) : message.delivered_count > 0 ? (
                <CheckCheck size={13} className="opacity-60" />
              ) : (
                <Check size={13} className="opacity-60" />
              )
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${isOwn ? 'justify-end' : ''}`}>
            {message.reactions.map((r, i) => (
              <button
                key={i}
                onClick={() => onReact(message.id, r.emoji)}
                className="rounded-full border border-separator/50 bg-background px-2 py-0.5 text-xs shadow-sm transition-all hover:scale-105 hover:border-accent/40 hover:bg-accent/10"
              >
                {r.emoji} <span className="text-muted">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Send error retry */}
        {isOwn && message._status === 'error' && (
          <button
            onClick={() => onRetry(message.id)}
            className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-danger hover:underline"
          >
            <RefreshCw size={10} />
            {t('chat.retrySend')}
          </button>
        )}
      </div>

      {/* Hover action bar */}
      <div
        className={`flex items-center gap-0.5 self-end pb-1 transition-all duration-150 ${
          showActions && message._status !== 'sending' && message._status !== 'error'
            ? 'opacity-100 translate-y-0'
            : 'pointer-events-none opacity-0 translate-y-1'
        }`}
      >
        {/* Emoji picker */}
        <div className="relative">
          <Tooltip content={t('chat.react')} placement={isOwn ? 'top' : 'top'}>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="h-7 w-7 min-w-0 rounded-full border border-separator/50 bg-background shadow-sm hover:border-accent/40"
              onPress={() => setShowEmojiPicker((p) => !p)}
            >
              <Smile size={13} />
            </Button>
          </Tooltip>
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`absolute bottom-8 ${isOwn ? 'right-0' : 'left-0'} z-20 flex gap-1 rounded-2xl border border-separator bg-background px-2 py-1.5 shadow-xl`}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { onReact(message.id, emoji); setShowEmojiPicker(false); }}
                    className="rounded-xl p-1 text-base transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Tooltip content={t('chat.reply')}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="h-7 w-7 min-w-0 rounded-full border border-separator/50 bg-background shadow-sm hover:border-accent/40"
            onPress={() => onReply(message)}
          >
            <Reply size={13} />
          </Button>
        </Tooltip>

        {isOwn && (
          <>
            <Tooltip content={t('common.edit')}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="h-7 w-7 min-w-0 rounded-full border border-separator/50 bg-background shadow-sm hover:border-accent/40"
                onPress={() => onEdit(message)}
              >
                <Pencil size={13} />
              </Button>
            </Tooltip>
            <Tooltip content={t('common.delete')}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="h-7 w-7 min-w-0 rounded-full border border-separator/50 bg-background shadow-sm hover:border-danger/40 hover:text-danger"
                onPress={() => onDelete(message)}
              >
                <Trash2 size={13} />
              </Button>
            </Tooltip>
          </>
        )}
      </div>
      </>)}
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
    const body = input.trim();
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
        <MessageBubble
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

      <div className="flex h-full flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-separator bg-background px-3 py-3 shadow-sm md:px-4">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile back button */}
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
              <UserAvatar
                user={{ display_name: convName, presence: conversation.member_presence, avatar_url: conversation.other_avatar_url }}
                showStatus
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft ring-1 ring-accent-soft-hover">
                <Hash size={18} className="text-accent" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold leading-tight">{convName}</h2>
              {isDirect && conversation.member_presence && (
                <p className="text-xs text-muted capitalize leading-tight">{conversation.member_presence}</p>
              )}
              {!isDirect && conversation.member_count && (
                <p className="text-xs text-muted leading-tight">
                  {conversation.member_count} {t('chat.members')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Tooltip content={t('chat.voiceCall')}>
              <Button isIconOnly size="sm" variant="ghost" className="hidden rounded-xl hover:bg-default sm:flex">
                <Phone size={17} />
              </Button>
            </Tooltip>
            <Tooltip content={t('chat.videoCall')}>
              <Button isIconOnly size="sm" variant="ghost" className="hidden rounded-xl hover:bg-default sm:flex">
                <Video size={17} />
              </Button>
            </Tooltip>
            <Tooltip content={t('common.search')}>
              <Button isIconOnly size="sm" variant="ghost" className="hidden rounded-xl hover:bg-default sm:flex">
                <Search size={17} />
              </Button>
            </Tooltip>
            <Dropdown>
              <Button isIconOnly size="sm" variant="ghost" className="rounded-xl hover:bg-default">
                <MoreVertical size={17} />
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
            className="h-full overflow-y-auto overflow-x-hidden py-3"
          >
            {loadingMessages && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted">
                <Spinner size="lg" />
                <p className="text-xs">{t('chat.loadingMessages')}</p>
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

          {/* Scroll to bottom button — fixed to the viewport of the message area */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-separator bg-background shadow-lg transition-all hover:scale-110 hover:bg-default"
              >
                <ArrowDown size={15} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ── Typing indicator ── */}
        <AnimatePresence initial={false}>
          {typingText && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 32 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-1">
                <TypingDots />
                <p className="text-xs text-muted">{typingText}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Reply / Edit banner ── */}
        <AnimatePresence initial={false}>
          {(replyTo || editing) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="flex items-center gap-3 border-t border-separator bg-accent/5 px-4 py-2.5"
            >
              <div className={`w-0.5 self-stretch rounded-full ${editing ? 'bg-warning' : 'bg-accent'}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${editing ? 'text-warning' : 'text-accent'}`}>
                  {editing ? t('chat.editingMessage') : t('chat.replyingTo', { name: replyTo.sender_display_name })}
                </p>
                <p className="truncate text-xs text-muted">
                  {editing ? editing.body : replyTo.body}
                </p>
              </div>
              <button
                onClick={cancelAction}
                className="rounded-full p-1 text-muted transition-colors hover:bg-default hover:text-foreground"
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

        {/* ── Input area ── */}
        <div className="border-t border-separator bg-background px-3 py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-separator/70 bg-default px-2 py-1.5 transition-shadow focus-within:shadow-md focus-within:border-accent/40">
            <FilePickerMenu onPick={handleFilePick} disabled={!!previewFile || sendingFile} uploading={sendingFile} />

            <Input
              ref={inputRef}
              placeholder={t('chat.writeMessage')}
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
              className="flex-1 border-none bg-transparent shadow-none outline-none"
            />

            <SendButton
              onPress={handleSend}
              isDisabled={!input.trim()}
              label={t('chat.send')}
            />
          </div>
        </div>
      </div>
    </>
  );
}
