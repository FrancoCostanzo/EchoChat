import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Dropdown, Label, Spinner, Tooltip, toast } from '@heroui/react';
import {
  MoreVertical,
  Search,
  Pin,
  AtSign,
  Pencil,
  Hash,
  Users,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CornerUpLeft,
  X,
  Upload,
  ImageIcon,
  Phone,
  Video as VideoIcon,
  UserPlus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore } from '@/stores/callStore';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import SendButton from '@/components/SendButton';
import MessageSearchPanel from '@/components/MessageSearchPanel';
import PinnedMessageBar from '@/components/PinnedMessageBar';
import CallHistoryPanel from '@/components/CallHistoryPanel';
import ThreadPanel from '@/components/ThreadPanel';
import GamePickerMenu from '@/components/GamePickerMenu';
import MessageInfoModal from '@/components/MessageInfoModal';
import CreatePollModal from '@/components/CreatePollModal';
import CreateCodeModal from '@/components/CreateCodeModal';
import WallpaperPicker from '@/components/WallpaperPicker';
import FloatingComposer from '@/components/FloatingComposer';
import { handleFormatShortcut } from '@/components/FormatToolbar';
import DynamicMessageInput from '@/components/DynamicMessageInput';
import MentionAutocomplete, { useMentionAutocomplete } from '@/components/MentionAutocomplete';
import AvatarCropModal from '@/components/AvatarCropModal';
import ScheduleMessageModal from '@/components/ScheduleMessageModal';
import RemindMeModal from '@/components/RemindMeModal';
import StickerGifPicker from '@/components/StickerGifPicker';
import EmojiPicker from '@/components/EmojiPicker';
import { detectBodyFormat } from '@/lib/markdown';
import { parseCodeFence } from '@/lib/codeLanguages';
import {
  MESSAGE_DELETE_WINDOW_MS,
  MESSAGE_EDIT_WINDOW_MS,
  isWithinMessageWindow,
} from '@/lib/messageWindow';
import ConversationDetailPanel, { type DetailTab } from '@/components/ConversationDetailPanel';
import { storageApi, stickerApi, messagesApi } from '@/lib/endpoints';
import { EASE_OUT } from '@/lib/motion';
import type { ChatMessage } from '@/stores/chatStore';
import type { SendMessageRequest } from '@/types/message';
import type { CallType } from '@/types/call';
import type { TextInputHandle } from '@/lib/formatText';
import type { PickedItem } from '@/components/StickerGifPicker';
import type { FakeInputChangeEvent } from '@/components/DynamicMessageInput';
import {
  SPRING_OUT,
  type MessageSticker,
  QUICK_EMOJIS,
  type ContextMenuPos,
  type MessageMetadata,
} from '@/components/conversation/shared';
import FilePickerMenu from '@/components/conversation/FilePickerMenu';
import FilePreviewBar from '@/components/conversation/FilePreviewBar';
import TypingDots from '@/components/conversation/TypingDots';
import ConfirmDeleteModal from '@/components/conversation/ConfirmDeleteModal';
import MessageContextMenu from '@/components/conversation/MessageContextMenu';
import { buildMessageMenuItems } from '@/components/conversation/messageMenuItems';
import EmptyConversationState from '@/components/conversation/EmptyConversationState';
import DaySeparator from '@/components/conversation/DaySeparator';
import MessageRow from '@/components/conversation/MessageRow';
import ForwardModal from '@/components/conversation/ForwardModal';
import useChatScroll from '@/components/conversation/useChatScroll';
import useConversationDraft from '@/components/conversation/useConversationDraft';
import useTypingIndicator from '@/components/conversation/useTypingIndicator';
import useConversationWallpaper from '@/components/conversation/useConversationWallpaper';
import useContactStatus from '@/components/conversation/useContactStatus';
import useConversationMembers from '@/components/conversation/useConversationMembers';
import usePinnedMessage from '@/components/conversation/usePinnedMessage';
import useGroupAdmin from '@/components/conversation/useGroupAdmin';
import useFileDrop from '@/components/conversation/useFileDrop';

export default function ConversationPage() {
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  // Selectores atómicos: la página sólo se re-renderiza cuando cambia lo que usa.
  const messages = useChatStore((s) => s.messages);
  const loadingMessages = useChatStore((s) => s.loadingMessages);
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const retrySendMessage = useChatStore((s) => s.retrySendMessage);
  const editMessage = useChatStore((s) => s.editMessage);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const addReaction = useChatStore((s) => s.addReaction);
  const loadMoreMessages = useChatStore((s) => s.loadMoreMessages);
  const clearActiveConversation = useChatStore((s) => s.clearActiveConversation);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const patchMessage = useChatStore((s) => s.patchMessage);
  const joinConversation = useChatStore((s) => s.joinConversation);

  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null); // message object to confirm delete
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null); // message being forwarded
  const [infoTarget, setInfoTarget] = useState<ChatMessage | null>(null); // message whose info panel is open
  const [threadRoot, setThreadRoot] = useState<ChatMessage | null>(null); // root message of the open thread panel
  const [contextMenu, setContextMenu] = useState<ContextMenuPos | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [remindMessageId, setRemindMessageId] = useState<string | null>(null);
  const [sendPulse, setSendPulse] = useState(false);
  const [sendingHi, setSendingHi] = useState(false);
  const sendPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);
  // Which composer flyout is open — at most one at a time (attach menu, sticker/GIF, emoji).
  const [activePicker, setActivePicker] = useState<'file' | 'game' | 'sticker' | 'emoji' | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeModalInitial, setCodeModalInitial] = useState({ body: '', language: 'plaintext' });
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);

  const inputRef = useRef<TextInputHandle>(null);

  const conversation =
    conversations.find((c) => c.id === conversationId)
    ?? conversations.find((c) => c.id === activeConversationId);
  const isDirect = conversation?.type === 'direct';
  // member_user_id no existe en ConversationResponse (solo other_user_id) — el
  // fallback nunca tuvo efecto real.
  const otherUserId = isDirect ? conversation?.other_user_id : null;

  const { isContact, addingContact, handleAddContact } = useContactStatus(
    otherUserId,
    conversation?.display_name || conversation?.name,
  );
  const wallpaperStyle = useConversationWallpaper(conversationId, conversation?.type);
  // Foto del grupo: sólo la pueden cambiar owner/admin (el backend lo vuelve a chequear).
  const groupAdmin = useGroupAdmin(conversationId);
  const { members, membersWithPresence, loadingMembers } = useConversationMembers(conversationId, conversation, isDirect);
  const { pinnedMessage, handleTogglePin, handleUnpinBar } = usePinnedMessage(conversationId);
  const { typingText, notifyTyping, stopTyping } = useTypingIndicator(conversationId, user?.id);

  useEffect(() => {
    setMembersOpen(false);
  }, [conversationId]);

  // Autocompletado de @menciones del composer. En DMs `members` queda vacío
  // (no se piden) y el hook no sugiere nada, que es lo correcto: mencionar en
  // un chat de a dos no aporta.
  const mentions = useMentionAutocomplete({
    value: input,
    onChange: setInput,
    inputRef,
    members,
    excludeUserId: user?.id,
  });

  // Clear active conversation when leaving the page entirely
  useEffect(() => {
    return () => clearActiveConversation();
  }, [clearActiveConversation]);

  // Layout effect on purpose: setActiveConversation's synchronous part
  // (restoring the cached timeline) lands before the browser paints, so
  // switching chats never flashes the previous conversation's messages.
  useLayoutEffect(() => {
    if (conversationId) {
      setContextMenu(null);
      setActiveConversation(conversationId);
      // Aseguramos estar en la sala de socket de la conversación: el auto-join
      // del backend solo ocurre al conectar, así que reconexiones o salas nuevas
      // quedarían fuera y no llegarían los recibos (entregado/leído) en vivo.
      joinConversation(conversationId);
    }
  }, [conversationId, setActiveConversation, joinConversation]);

  const {
    containerRef,
    messagesContentRef,
    messagesEndRef,
    showScrollBtn,
    handleScroll,
    scrollToBottom,
    loadOlder,
  } = useChatScroll({ conversationId, messages, loadingMessages, hasMoreMessages, loadMoreMessages });

  // Reset composer state when switching conversations (the draft hook reloads the text)
  useEffect(() => {
    if (!conversationId) return;
    setReplyTo(null);
    setEditing(null);
    setThreadRoot(null);
  }, [conversationId]);

  const { discardDraft } = useConversationDraft(conversationId, input, setInput, !!editing);

  const handleSend = async () => {
    const body = (input ?? '').trim();
    if (!body || !conversationId || soloAdminsEnvianMensajes) return;

    stopTyping();

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
        toast.danger((err instanceof Error && err.message) || t('chat.editWindowExpired'));
        return;
      }
    } else {
      const bodyFormat = detectBodyFormat(body);
      const data: SendMessageRequest = { conversation_id: conversationId, body, type: 'text', body_format: bodyFormat };
      if (replyTo) data.reply_to_id = replyTo.id;
      if (sendPulseTimerRef.current) clearTimeout(sendPulseTimerRef.current);
      setSendPulse(true);
      sendPulseTimerRef.current = setTimeout(() => setSendPulse(false), 400);
      await sendMessage(data, user ?? undefined);
      setReplyTo(null);
      // The message was sent — drop any saved draft for this conversation
      discardDraft();
    }
    setInput('');
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Con el popup de menciones abierto, Enter/Tab/flechas son suyas: si no,
    // Enter enviaría el mensaje en vez de completar el nombre.
    if (mentions.onKeyDown(e)) return;
    if (handleFormatShortcut(e, inputRef, setInput, t)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      cancelAction();
    }
  };

  // Sólo owner/admin de un grupo o canal; el backend lo vuelve a validar.
  const esAdminDeGrupo = !isDirect && ['owner', 'admin'].includes(conversation?.member_role ?? '');
  // Si el admin desactivó only_admins_edit_info, cualquier miembro puede editar.
  const puedeEditarGrupo = esAdminDeGrupo || (!isDirect && conversation?.only_admins_edit_info === false);
  // is_read_only: el admin restringió el envío de mensajes a sólo admins.
  const soloAdminsEnvianMensajes = !isDirect && !!conversation?.is_read_only && !esAdminDeGrupo;

  const handleFilePick = useCallback((file: File) => {
    setPreviewFile(file);
  }, []);

  // Stickers & GIFs travel as a lightweight `sticker` message whose payload
  // lives in metadata; the body stays empty. Two sources:
  //   · custom — a user-uploaded sticker in storage (referenced by object_id)
  //   · giphy  — an external GIF hosted on Giphy's CDN (referenced by url)
  const handleStickerSend = useCallback(async (item: PickedItem) => {
    if (!item || !conversationId) return;
    const sticker: MessageSticker =
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

    const data: SendMessageRequest = { conversation_id: conversationId, type: 'sticker', metadata: { sticker } };
    if (replyTo) data.reply_to_id = replyTo.id;
    try {
      await sendMessage(data, user ?? undefined);
      setReplyTo(null);
    } catch (err) {
      console.error('Sticker send failed:', err);
    }
  }, [conversationId, replyTo, sendMessage, user]);

  const handleFileSend = useCallback(async (file: File, caption: string) => {
    if (!conversationId) return;
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
      const msgData: SendMessageRequest & { _filename?: string } = {
        conversation_id: conversationId,
        type: 'media',
        attachment_ids: [storageObj.id],
        _filename: file.name,
      };
      if (caption) {
        msgData.body = caption;
        msgData.body_format = detectBodyFormat(caption);
      }
      await sendMessage(msgData, user ?? undefined);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setSendingFile(false);
    }
  }, [conversationId, sendMessage, user]);

  // Drag & drop / paste-to-attach. Reuses the single-file preview flow: the
  // first dropped or pasted file opens the FilePreviewBar with a caption.
  const acceptDroppedFile = useCallback((file: File) => {
    if (file && !previewFile && !sendingFile) setPreviewFile(file);
  }, [previewFile, sendingFile]);

  const { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(acceptDroppedFile);

  const handlePaste = useCallback((e: ReactClipboardEvent<HTMLDivElement>) => {
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
  const scrollToMessage = useCallback((id: string, { closeSearch = false }: { closeSearch?: boolean } = {}) => {
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
      setMembersOpen(false);
    }
  }, [containerRef]);

  const handleJumpToMessage = useCallback((id: string) => {
    scrollToMessage(id, { closeSearch: true });
  }, [scrollToMessage]);

  const focusMessageById = useCallback(async (id: string) => {
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

  const handleEdit = useCallback((msg: ChatMessage) => {
    if (!msg.body) return;
    setEditing(msg);
    setInput(msg.body);
    setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTo(msg);
    setEditing(null);
    setTimeout(() => {
      focusMessageById(msg.id);
      inputRef.current?.focus();
    }, 80);
  }, [focusMessageById]);

  // Opens confirm modal instead of deleting immediately
  const handleDeleteRequest = useCallback((msg: ChatMessage) => {
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
      toast.danger((err instanceof Error && err.message) || t('chat.deleteWindowExpired'));
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const handleReact = useCallback(async (msgId: string, emoji: string) => {
    await addReaction(msgId, emoji);
  }, [addReaction]);

  const cancelAction = () => {
    setReplyTo(null);
    setEditing(null);
    setInput('');
  };

  const handleForward = useCallback((msg: ChatMessage) => setForwardTarget(msg), []);
  const handleOpenInfo = useCallback((msg: ChatMessage) => setInfoTarget(msg), []);

  // One-tap wave from the empty state
  const handleSayHi = useCallback(async () => {
    if (!conversationId) return;
    setSendingHi(true);
    try {
      await sendMessage(
        { conversation_id: conversationId, body: '👋', type: 'text', body_format: detectBodyFormat('👋') },
        user ?? undefined,
      );
    } finally {
      setSendingHi(false);
    }
  }, [conversationId, sendMessage, user]);

  // Thread, search and members panels share the right column — only one open at a time
  const handleOpenThread = useCallback((msg: ChatMessage) => {
    setThreadRoot(msg);
    setSearchOpen(false);
    setMembersOpen(false);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen((p) => !p);
    setThreadRoot(null);
    setHistoryOpen(false);
    setMembersOpen(false);
  }, []);

  const handleOpenHistory = useCallback(() => {
    setHistoryOpen((p) => !p);
    setSearchOpen(false);
    setThreadRoot(null);
    setMembersOpen(false);
  }, []);

  const handleOpenMembers = useCallback(() => {
    setDetailTab('members');
    setMembersOpen((p) => !p);
    setSearchOpen(false);
    setThreadRoot(null);
    setHistoryOpen(false);
  }, []);

  // Click en el nombre/foto del header: abre el mismo panel pero en la pestaña Info.
  const handleOpenDetailInfo = useCallback(() => {
    setDetailTab('info');
    setMembersOpen(true);
    setSearchOpen(false);
    setThreadRoot(null);
    setHistoryOpen(false);
  }, []);

  const startCall = useCallStore((s) => s.startCall);
  const callStatus = useCallStore((s) => s.status);
  const handleStartCall = useCallback(async (type: CallType) => {
    if (!conversationId) return;
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
        self: user ?? undefined,
      });
    } catch (err) {
      const msg = (err as { name?: string })?.name === 'NotAllowedError'
        ? t('call.permissionDenied')
        : t('call.startFailed');
      toast.danger(msg);
    }
  }, [callStatus, startCall, conversationId, conversation, user, t]);

  const handleSavedChange = useCallback((messageId: string, isSaved: boolean) => {
    patchMessage(messageId, { is_saved: isSaved });
  }, [patchMessage]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleOpenContextMenu = useCallback((messageId: string, pos: { x: number; y: number }) => {
    setContextMenu({ messageId, ...pos });
  }, []);

  const handleToggleSave = useCallback(async (message: ChatMessage) => {
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
  const handleSaveSticker = useCallback(async (message: ChatMessage) => {
    const objectId = (message.metadata as MessageMetadata | null)?.sticker?.object_id;
    if (!objectId) return;
    try {
      await stickerApi.save(objectId);
      toast.success(t('sticker.savedToCollection'));
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('sticker.uploadError'));
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
        pinned: pinnedMessage?.id === contextMenuMessage.id,
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
        onRemind: (m: ChatMessage) => setRemindMessageId(m.id),
      })
    : [];

  const messageElements = useMemo(() => {
    const isDirect = conversation?.type === 'direct';
    const dayOf = (m: ChatMessage | undefined) => (m?.sent_at ? new Date(m.sent_at).toDateString() : null);
    const els: ReactNode[] = [];
    messages.forEach((msg, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      // Un nuevo día corta el agrupamiento por remitente y agrega un separador.
      const dayChanged = !prev || dayOf(prev) !== dayOf(msg);
      const nextDayChanged = !next || dayOf(next) !== dayOf(msg);
      const isFirstInGroup = dayChanged || prev?.sender_id !== msg.sender_id;
      const isLastInGroup = nextDayChanged || next?.sender_id !== msg.sender_id;

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
          onReact={handleReact}
          onOpenThread={handleOpenThread}
          onRetry={retrySendMessage}
          currentUserId={user?.id}
          currentUser={user}
        />
      );
    });
    return els;
  }, [messages, user, conversation?.type, contextMenu?.messageId, handleOpenContextMenu, focusMessageById, handleReact, handleOpenThread, retrySendMessage]);

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
        conversationId={conversationId as string}
        onClose={() => setShowPollModal(false)}
      />

      <input
        ref={groupAdmin.groupAvatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={groupAdmin.handleGroupAvatarPick}
      />

      <AvatarCropModal
        isOpen={!!groupAdmin.groupAvatarSrc}
        imageSrc={groupAdmin.groupAvatarSrc}
        fileName={groupAdmin.groupAvatarName}
        onClose={groupAdmin.closeGroupAvatarCrop}
        onConfirm={groupAdmin.handleGroupAvatarConfirm}
        loading={groupAdmin.groupAvatarLoading}
      />

      <ScheduleMessageModal
        isOpen={showScheduleModal}
        conversationId={conversationId as string}
        initialBody={input}
        onClose={() => setShowScheduleModal(false)}
        // Lo que se programó ya no tiene que quedar en el composer ni en el
        // borrador: si no, se manda dos veces.
        onScheduled={() => {
          setInput('');
          discardDraft();
        }}
      />

      <RemindMeModal
        isOpen={!!remindMessageId}
        messageId={remindMessageId}
        onClose={() => setRemindMessageId(null)}
      />

      <CreateCodeModal
        isOpen={showCodeModal}
        conversationId={conversationId as string}
        initialBody={codeModalInitial.body}
        initialLanguage={codeModalInitial.language}
        onClose={() => setShowCodeModal(false)}
      />

      {wallpaperPickerOpen && (
        <WallpaperPicker
          isOpen={wallpaperPickerOpen}
          onClose={() => setWallpaperPickerOpen(false)}
          scope="conversation"
          scopeKey={conversationId as string}
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
              role="button"
              tabIndex={0}
              onClick={handleOpenDetailInfo}
              onKeyDown={(e) => { if (e.key === 'Enter') handleOpenDetailInfo(); }}
              title={t('chat.detailTitle')}
              className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 -mx-1 py-0.5 transition-colors hover:bg-white/5 md:gap-3"
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
                {/* Estado de ausencia: por qué no está, no sólo que no está. */}
                {conversation.member_presence_message && (
                  <span className="hidden truncate text-[13px] italic text-ink-200 lg:inline-block">
                    {conversation.member_presence_message}
                  </span>
                )}
              </>
            ) : conversation.type === 'group' ? (
              <>
                {conversation.avatar_url ? (
                  <img src={conversation.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-600">
                    <Users size={15} strokeWidth={2.5} className="text-ink-100" />
                  </div>
                )}
                <h2 className="echo-display truncate text-2xl font-semibold tracking-tight leading-tight">{convName}</h2>
                {/* member_count no existe en ConversationResponse (solo en ChannelResponse) —
                    este contador nunca se mostró; se documenta en vez de simularlo. */}
              </>
            ) : (
              <>
                {conversation.avatar_url ? (
                  <img src={conversation.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <Hash size={22} strokeWidth={2.5} className="shrink-0 text-ink-200" />
                )}
                <h2 className="echo-display truncate text-2xl font-semibold tracking-tight leading-tight">{convName}</h2>
                {/* member_count no existe en ConversationResponse (solo en ChannelResponse) —
                    este contador nunca se mostró; se documenta en vez de simularlo. */}
              </>
            )}
            </motion.div>
          </div>

          <div className="flex items-center gap-0.5">
            {isDirect && isContact === false && (
              <Tooltip delay={0}>
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
                <Tooltip.Content placement="bottom">{t('contacts.addFromChat')}</Tooltip.Content>
              </Tooltip>
            )}
            {conversation.type !== 'channel' && (
              <>
                <Tooltip delay={0}>
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
                  <Tooltip.Content placement="bottom">{t('call.startVoice')}</Tooltip.Content>
                </Tooltip>
                <Tooltip delay={0}>
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
                  <Tooltip.Content placement="bottom">{t('call.startVideo')}</Tooltip.Content>
                </Tooltip>
              </>
            )}
            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => pinnedMessage && focusMessageById(pinnedMessage.id)}
                isDisabled={!pinnedMessage}
                className="relative hidden h-8 w-8 min-w-0 rounded-md text-ink-100 hover:bg-ink-600 hover:text-foreground disabled:opacity-40 sm:flex"
              >
                <Pin size={18} />
              </Button>
              <Tooltip.Content placement="bottom">{t('chat.pinnedMessages')}</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
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
              <Tooltip.Content placement="bottom">{t('chat.searchMessages')}</Tooltip.Content>
            </Tooltip>
            {!isDirect && (
              <Tooltip delay={0}>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={handleOpenMembers}
                  className={[
                    'h-8 w-8 min-w-0 rounded-md hover:bg-ink-600 hover:text-foreground',
                    membersOpen ? 'bg-ink-600 text-foreground' : 'text-ink-100',
                  ].join(' ')}
                  aria-label={t('chat.viewMembers')}
                >
                  <Users size={18} />
                </Button>
                <Tooltip.Content placement="bottom">{t('chat.viewMembers')}</Tooltip.Content>
              </Tooltip>
            )}
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
                  {pinnedMessage && (
                    <Dropdown.Item id="pinned" textValue={t('chat.pinnedMessages')} onAction={() => focusMessageById(pinnedMessage.id)}>
                      <Pin size={15} />
                      <Label>{t('chat.pinnedMessages')}</Label>
                    </Dropdown.Item>
                  )}
                  {conversation.type !== 'channel' && (
                    <Dropdown.Item id="callHistory" textValue={t('call.history.title')} onAction={handleOpenHistory}>
                      <Phone size={15} />
                      <Label>{t('call.history.title')}</Label>
                    </Dropdown.Item>
                  )}
                  {!isDirect && (
                    <Dropdown.Item id="members" textValue={t('chat.viewMembers')} onAction={handleOpenMembers}>
                      <Users size={15} />
                      <Label>{t('chat.memberPanel')}</Label>
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

        {/* ── Mensaje fijado — debajo de la info del chat, igual para directos y grupos ── */}
        <PinnedMessageBar
          message={pinnedMessage}
          onJump={focusMessageById}
          onUnpin={handleUnpinBar}
        />

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
                  onPress={loadOlder}
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
                      {editing ? t('chat.editingMessage') : t('chat.replyingTo', { name: replyTo?.sender_display_name ?? undefined })}
                    </span>
                    {' — '}
                    <span className="text-ink-200">
                      {editing ? editing.body : replyTo?.body}
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
              onSchedule={() => setShowScheduleModal(true)}
              onPoll={() => setShowPollModal(true)}
              onCode={() => {
                setCodeModalInitial({ body: '', language: 'plaintext' });
                setShowCodeModal(true);
              }}
              disabled={!!previewFile || sendingFile || soloAdminsEnvianMensajes}
              uploading={sendingFile}
              open={activePicker === 'file'}
              onOpenChange={(next) => setActivePicker(next ? 'file' : null)}
            />

            <div className="relative flex min-w-0 flex-1">
            <MentionAutocomplete
              open={mentions.activo}
              options={mentions.sugerencias}
              activeIndex={mentions.indice}
              onSelect={mentions.seleccionar}
              onHover={mentions.setIndice}
            />
            <DynamicMessageInput
              ref={inputRef}
              placeholder={soloAdminsEnvianMensajes
                ? t('chat.onlyAdminsSendMessages')
                : isDirect
                ? t('chat.writeMessage') + ` @${convName}`
                : t('chat.writeMessage') + ` #${convName}`}
              value={input}
              onChange={(e: FakeInputChangeEvent) => {
                setInput(e.target.value);
                mentions.detectar(e.target.value);
                notifyTyping();
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={soloAdminsEnvianMensajes}
            />
            </div>

            {isDirect && (
              <GamePickerMenu
                conversationId={conversationId as string}
                disabled={!!previewFile || sendingFile}
                open={activePicker === 'game'}
                onOpenChange={(next) => setActivePicker(next ? 'game' : null)}
              />
            )}

            <StickerGifPicker
              onPick={handleStickerSend}
              disabled={!!previewFile || sendingFile || soloAdminsEnvianMensajes}
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
              isDisabled={!(input ?? '').trim() || soloAdminsEnvianMensajes}
              label={t('chat.send')}
              pulse={sendPulse}
              className="shrink-0"
            />
          </div>
        </FloatingComposer>
        </div>

        <ConversationDetailPanel
          key={conversationId}
          conversation={conversation}
          conversationId={conversationId as string}
          isDirect={isDirect}
          canEditGroup={puedeEditarGrupo}
          isGroupAdmin={esAdminDeGrupo}
          members={membersWithPresence}
          loading={loadingMembers}
          open={membersOpen}
          onOpenChange={setMembersOpen}
          activeTab={detailTab}
          onTabChange={setDetailTab}
          onJump={handleJumpToMessage}
          onPickAvatar={() => groupAdmin.groupAvatarInputRef.current?.click()}
          onRemoveAvatar={groupAdmin.handleGroupAvatarRemove}
          onUpdateInfo={groupAdmin.handleUpdateGroupInfo}
          onUpdatePermissions={groupAdmin.handleUpdateGroupPermissions}
        />

        {/* ── Message search panel ── */}
        <AnimatePresence>
          {searchOpen && (
            <MessageSearchPanel
              conversationId={conversationId as string}
              onClose={() => setSearchOpen(false)}
              onJump={handleJumpToMessage}
            />
          )}
        </AnimatePresence>

        {/* ── Call history panel ── */}
        <AnimatePresence>
          {historyOpen && (
            <CallHistoryPanel
              conversationId={conversationId as string}
              selfId={user?.id as string}
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
              conversationId={conversationId as string}
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
