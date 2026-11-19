import {
  useRef,
  memo,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@heroui/react';
import {
  Paperclip,
  Smile,
  BookmarkCheck,
  Trash2,
  Clock,
  Check,
  CheckCheck,
  Loader,
  AlertCircle,
  RefreshCw,
  MessageSquareText,
  Sticker,
  Megaphone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import PollMessage from '@/components/PollMessage';
import CodeMessage from '@/components/CodeMessage';
import GameMessage from '@/components/GameMessage';
import { formatMessageTime, formatFullTime } from '@/lib/dates';
import { readMentions } from '@/lib/mentions';
import MessageBody from '@/components/MessageBody';
import { EASE_OUT, SPRING_BOUNCY, msgEntryInitial, msgEntryTransition } from '@/lib/motion';
import { userColor } from '@/lib/userColor';
import type { ChatMessage } from '@/stores/chatStore';
import type { AuthenticatedUser } from '@/types/user';
import type { MessageMetadata } from '@/components/conversation/shared';
import AttachmentView, { StickerImage } from '@/components/conversation/AttachmentView';
import CallEventRow from '@/components/conversation/CallEventRow';

function ReactionPill({
  emoji,
  count,
  mine,
  onClick,
}: {
  emoji: string;
  count: number;
  mine?: boolean;
  onClick: () => void;
}) {
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
function ReceiptIcon({ message }: { message: ChatMessage }) {
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

interface MessageRowProps {
  message: ChatMessage;
  isOwn: boolean;
  isDirect: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isContextOpen: boolean;
  shouldAnimateEntry: boolean;
  onOpenContextMenu: (messageId: string, pos: { x: number; y: number }) => void;
  onScrollToReply: (id: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onOpenThread: (message: ChatMessage) => void;
  onRetry: (tempId: string) => void;
  currentUserId?: string;
  currentUser?: AuthenticatedUser | null;
}

const MessageRow = memo(function MessageRow({ message, isOwn, isDirect, isFirstInGroup, isLastInGroup, isContextOpen, shouldAnimateEntry, onOpenContextMenu, onScrollToReply, onReact, onOpenThread, onRetry, currentUserId, currentUser }: MessageRowProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const saved = !!message.is_saved;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPending = message._status === 'sending' || message._status === 'error';

  const meta = message.metadata as MessageMetadata | null;

  const displayName = isOwn
    ? (currentUser?.display_name || message.sender_display_name || t('common.you'))
    : message.sender_display_name;
  const avatarUrl = isOwn ? currentUser?.avatar_url : (message.sender_avatar_url ?? undefined);

  const showName = !isOwn && !isDirect && isFirstInGroup;
  const showAvatar = !isOwn && !isDirect;

  // ── Context-menu (right-click / long-press) ──
  const actionable = !isPending && !message.is_deleted;
  const openMenuAt = (x: number, y: number) => onOpenContextMenu(message.id, { x, y });
  const openMenu = (e: ReactMouseEvent | ReactTouchEvent) => {
    if (!actionable) return;
    e.preventDefault();
    const mouseEvent = e as ReactMouseEvent;
    const touchEvent = e as ReactTouchEvent;
    openMenuAt(
      mouseEvent.clientX ?? touchEvent.touches?.[0]?.clientX ?? 0,
      mouseEvent.clientY ?? touchEvent.touches?.[0]?.clientY ?? 0,
    );
  };
  const handleTouchStart = (e: ReactTouchEvent) => {
    if (!actionable) return;
    const t0 = e.touches[0];
    const { clientX, clientY } = t0;
    longPressTimer.current = setTimeout(() => openMenuAt(clientX, clientY), 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const sticker = message.type === 'sticker' ? meta?.sticker : null;
  const isSticker = Boolean(sticker);
  const broadcastListName = meta?.broadcast_list_name || null;
  const isBroadcast = Boolean(meta?.broadcast_msg_id || meta?.broadcast_list_id);

  const isMediaOnly =
    message.type === 'media' && (message.attachments?.length ?? 0) > 0 && !message.body;

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
          // Solid fill, not glass: the bubble is primary content, so its
          // contrast can't depend on which wallpaper happens to sit behind it.
          : 'bg-ink-800 text-ink-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-white/8',
        'rounded-2xl',
        isFirstInGroup ? (isOwn ? 'rounded-tr-md' : 'rounded-tl-md') : '',
        isContextOpen ? 'echo-selected' : '',
      ].join(' ');

  const metaClass = isSticker ? 'text-ink-200' : isOwn ? 'echo-on-accent-muted' : 'text-ink-200';

  const justSent = isOwn && message._status === 'sent';

  // ── Evento de llamada en el timeline (sirve de aviso e historial) ──
  if (message.type === 'system' && meta?.event === 'call') {
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
                if (message.reply_to_id) onScrollToReply(message.reply_to_id);
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
                <PollMessage message={message} currentUserId={currentUserId} variant={isOwn ? 'own' : 'other'} />
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
              {isSticker && sticker && (
                <StickerImage
                  sticker={sticker}
                  sending={message._status === 'sending'}
                  error={message._status === 'error'}
                />
              )}

              {/* Auto-respuesta de ausencia: se aclara para que no se lea como
                  una respuesta escrita en el momento. */}
              {meta?.auto_reply && (
                <span className={[
                  'mb-0.5 inline-flex items-center gap-1 text-[11px] italic',
                  isOwn ? 'echo-on-accent opacity-80' : 'text-ink-200',
                ].join(' ')}>
                  <Clock size={10} className="shrink-0" />
                  {t('chat.autoReply')}
                </span>
              )}

              {/* Body */}
              {message.type !== 'media' && message.type !== 'poll' && message.type !== 'code' && message.type !== 'sticker' && message.type !== 'game' && message.body && (
                <MessageBody
                  body={message.body}
                  bodyFormat={message.body_format ?? undefined}
                  variant={isOwn ? 'own' : 'other'}
                  mentions={readMentions(message.metadata)}
                  currentUserId={currentUserId}
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
              <span title={t('chat.savedMessage')}>
                <BookmarkCheck size={10} className="shrink-0 opacity-90" />
              </span>
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
                mine={Boolean(Array.isArray(r.user_ids) && currentUserId && r.user_ids.includes(currentUserId))}
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

export default MessageRow;
