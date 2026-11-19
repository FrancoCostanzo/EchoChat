import {
  Pin,
  PinOff,
  Reply,
  Forward,
  Bookmark,
  BookmarkCheck,
  Pencil,
  Copy,
  Trash2,
  AlarmClock,
  MessageSquareText,
  Info,
  Sticker,
} from 'lucide-react';
import {
  MESSAGE_DELETE_WINDOW_MS,
  MESSAGE_EDIT_WINDOW_MS,
  isWithinMessageWindow,
} from '@/lib/messageWindow';
import type { ChatMessage } from '@/stores/chatStore';
import type { TFunc, MessageSticker, MenuAction } from '@/components/conversation/shared';

export function buildMessageMenuItems({
  message, isOwn, saved, pinned, t, closeMenu,
  onReply, onOpenThread, onForward, onEdit, onDelete, onToggleSave, onTogglePin, onInfo, onSaveSticker, onRemind,
}: {
  message: ChatMessage;
  isOwn: boolean;
  saved: boolean;
  pinned: boolean;
  t: TFunc;
  closeMenu: () => void;
  onReply: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onToggleSave: (message: ChatMessage) => void;
  onTogglePin: (message: ChatMessage) => void;
  onInfo: (message: ChatMessage) => void;
  onSaveSticker: (message: ChatMessage) => void;
  onRemind: (message: ChatMessage) => void;
}): (MenuAction | false)[] {
  const withinEditWindow = isWithinMessageWindow(message.sent_at, MESSAGE_EDIT_WINDOW_MS);
  const withinDeleteWindow = isWithinMessageWindow(message.sent_at, MESSAGE_DELETE_WINDOW_MS);
  const canEdit = isOwn
    && withinEditWindow
    && !message.is_deleted
    && (message.type !== 'media' || message.body);
  const canDelete = isOwn && withinDeleteWindow && !message.is_deleted;
  const canCopy = !!message.body;
  const messageSticker = (message.metadata as { sticker?: MessageSticker } | null)?.sticker;
  // Only custom stickers can be saved — Giphy GIFs are external URLs, not storage objects.
  const canSaveSticker = message.type === 'sticker'
    && messageSticker?.source === 'custom'
    && !!messageSticker?.object_id;
  return [
    { key: 'reply', icon: Reply, label: t('chat.reply'), onClick: () => { closeMenu(); onReply(message); } },
    !message.thread_id && { key: 'thread', icon: MessageSquareText, label: t('chat.replyInThread'), onClick: () => { closeMenu(); onOpenThread(message); } },
    { key: 'forward', icon: Forward, label: t('chat.forward'), onClick: () => { closeMenu(); onForward(message); } },
    !!canSaveSticker && { key: 'saveSticker', icon: Sticker, label: t('sticker.saveToCollection'), onClick: () => { closeMenu(); onSaveSticker(message); } },
    canCopy && { key: 'copy', icon: Copy, label: t('chat.copyText'), onClick: () => { closeMenu(); navigator.clipboard?.writeText(message.body || ''); } },
    { key: 'pin', icon: pinned ? PinOff : Pin, label: pinned ? t('chat.unpin') : t('chat.pin'), onClick: () => { closeMenu(); onTogglePin(message); } },
    { key: 'save', icon: saved ? BookmarkCheck : Bookmark, label: saved ? t('saved.remove') : t('chat.save'), onClick: () => { closeMenu(); onToggleSave(message); } },
    !message.is_deleted && { key: 'remind', icon: AlarmClock, label: t('remind.action'), onClick: () => { closeMenu(); onRemind(message); } },
    isOwn && { key: 'info', icon: Info, label: t('chat.messageInfo'), onClick: () => { closeMenu(); onInfo(message); } },
    !!canEdit && { key: 'edit', icon: Pencil, label: t('common.edit'), onClick: () => { closeMenu(); onEdit(message); } },
    canDelete && { key: 'delete', icon: Trash2, label: t('common.delete'), danger: true, onClick: () => { closeMenu(); onDelete(message); } },
  ];
}
