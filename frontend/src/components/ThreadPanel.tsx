import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button, Spinner } from '@heroui/react';
import { X, Paperclip, MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { messagesApi } from '@/lib/endpoints';
import { getSocket } from '@/lib/socket';
import UserAvatar from '@/components/UserAvatar';
import SendButton from '@/components/SendButton';
import MessageBody from '@/components/MessageBody';
import CodeMessage from '@/components/CodeMessage';
import { handleFormatShortcut } from '@/components/FormatToolbar';
import DynamicMessageInput from '@/components/DynamicMessageInput';
import { detectBodyFormat } from '@/lib/markdown';
import { formatMessageTime } from '@/lib/dates';
import type { MessageResponse } from '@/types/message';

function ThreadMessage({ msg, isRoot = false }: { msg: MessageResponse; isRoot?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={[
      'flex gap-2 px-3 py-1.5',
      isRoot ? 'rounded-lg bg-ink-900/60 py-2.5 ring-1 ring-white/8' : 'rounded-md hover:bg-white/2.5',
    ].join(' ')}>
      <div className="shrink-0 pt-0.5">
        <UserAvatar user={{ display_name: msg.sender_display_name }} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {msg.sender_display_name}
          </span>
          <span className="shrink-0 text-[10px] text-ink-200">{formatMessageTime(msg.sent_at)}</span>
        </div>
        {msg.type === 'code' && msg.body ? (
          <CodeMessage message={msg} variant="other" />
        ) : msg.body ? (
          <MessageBody
            body={msg.body}
            bodyFormat={msg.body_format ?? undefined}
            variant="other"
            size="sm"
          />
        ) : null}
        {msg.attachments?.length > 0 && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] italic text-ink-200">
            <Paperclip size={11} />
            {t('chat.attachedFile')}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ThreadPanel — Slack-style side panel: root message on top,
   live-updating replies below and its own composer.
   ───────────────────────────────────────────────────────── */
interface ThreadPanelProps {
  root: MessageResponse;
  conversationId: string;
  onClose: () => void;
}

export default function ThreadPanel({ root, conversationId, onClose }: ThreadPanelProps) {
  const { t } = useTranslation();
  const [rootMsg, setRootMsg] = useState(root);
  const [replies, setReplies] = useState<MessageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Load the full thread when the panel opens or the root changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReplies([]);
    setRootMsg(root);
    messagesApi.getThread(root.id)
      .then(({ data }) => {
        if (!active) return;
        setRootMsg(data.root);
        setReplies(data.replies);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [root.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: append replies for this thread as they arrive
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (message: MessageResponse) => {
      if (message.thread_id !== root.id) return;
      setReplies((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
    };
    socket.on('message:new', handler);
    return () => { socket.off('message:new', handler); };
  }, [root.id]);

  // Keep the latest reply in view
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [replies.length, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [root.id]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const bodyFormat = detectBodyFormat(body);
      const { data } = await messagesApi.send({
        conversation_id: conversationId,
        type: 'text',
        body,
        body_format: bodyFormat,
        thread_id: root.id,
      });
      setReplies((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, data]
      );
      setInput('');
    } catch {
      // keep the text so the user can retry
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0.6 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.6 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-black/30 bg-ink-800 shadow-2xl md:static md:z-0 md:w-80 md:shrink-0"
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-black/20 px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <MessageSquareText size={16} className="text-ink-100" />
          <h3 className="text-[15px] font-semibold">{t('chat.thread')}</h3>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="h-7 w-7 min-w-0"
          onPress={onClose}
          aria-label={t('common.close')}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ThreadMessage msg={rootMsg} isRoot />

        <div className="my-2 flex items-center gap-2 px-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-200">
            {replies.length > 0
              ? t('chat.threadReplies', { count: replies.length })
              : t('chat.thread')}
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : replies.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-200">
            {t('chat.threadNoReplies')}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {replies.map((msg) => (
              <ThreadMessage key={msg.id} msg={msg} />
            ))}
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-black/20 p-3">
        <div className="echo-glass flex min-w-0 items-center gap-1 overflow-hidden rounded-xl px-1 pb-1 pt-1 transition-shadow focus-within:ring-2 focus-within:ring-accent/55 sm:gap-2">
          <DynamicMessageInput
            ref={inputRef}
            size="sm"
            placeholder={t('chat.threadReplyPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (handleFormatShortcut(e, inputRef, setInput, t)) return;
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              if (e.key === 'Escape') onClose();
            }}
            disabled={sending}
          />
          <SendButton
            onPress={handleSend}
            isDisabled={!input.trim() || sending}
            label={t('chat.send')}
            className="shrink-0"
          />
        </div>
      </div>
    </motion.aside>
  );
}
