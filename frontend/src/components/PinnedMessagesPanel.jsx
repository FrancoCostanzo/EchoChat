import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Pin, PinOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { messagesApi } from '@/lib/endpoints';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/dates';

/* ─────────────────────────────────────────────────────────
   PinnedMessagesPanel — right-hand panel listing the pinned
   messages of a conversation. Click a row to jump to it;
   the pin-off button unpins in place.
   ───────────────────────────────────────────────────────── */
export default function PinnedMessagesPanel({ conversationId, onClose, onJump, onUnpinned }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await messagesApi.getPinned(conversationId);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  const handleUnpin = async (msgId) => {
    setItems((prev) => prev.filter((m) => m.id !== msgId));
    try {
      await messagesApi.unpin(conversationId, msgId);
      onUnpinned?.(msgId);
    } catch {
      load(); // restore on failure
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
          <Pin size={16} className="text-accent" />
          <h3 className="text-[15px] font-semibold">{t('chat.pinnedMessages')}</h3>
          {!loading && items.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/15 px-1.5 text-[11px] font-bold text-accent">
              {items.length}
            </span>
          )}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="flex flex-col gap-2 px-1 pt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md px-2 py-2">
                <div className="echo-shimmer h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
                  <div className="echo-shimmer h-3 w-24 rounded-full" />
                  <div className="echo-shimmer h-3 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-ink-200">
            <Pin size={30} className="opacity-40" />
            <p className="text-[13px] font-medium">{t('chat.noPinned')}</p>
            <p className="text-[12px] text-ink-300">{t('chat.noPinnedHint')}</p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {items.map((msg) => (
            <div
              key={msg.id}
              className="group relative rounded-md transition-colors hover:bg-ink-750"
            >
              <Button
                variant="ghost"
                onPress={() => onJump?.(msg.id)}
                className="flex h-auto w-full flex-col items-stretch justify-start gap-1 whitespace-normal rounded-md px-2 py-2 text-left hover:bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <UserAvatar
                    user={{ display_name: msg.sender_display_name, avatar_url: msg.sender_avatar_url }}
                    size="sm"
                  />
                  <span className="truncate text-[13px] font-semibold text-foreground">
                    {msg.sender_display_name}
                  </span>
                  <span className="ml-auto shrink-0 pr-7 text-[10px] text-ink-200">
                    {formatMessageTime(msg.sent_at)}
                  </span>
                </div>
                <p className="line-clamp-3 pl-9 text-[13px] leading-snug text-ink-100">
                  {msg.body || <span className="italic text-ink-200">{t('chat.attachedFile')}</span>}
                </p>
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => handleUnpin(msg.id)}
                aria-label={t('chat.unpin')}
                className="absolute right-1.5 top-1.5 h-6 w-6 min-w-0 rounded-md text-ink-300 opacity-0 transition-opacity hover:text-echo-dnd group-hover:opacity-100 focus-visible:opacity-100"
              >
                <PinOff size={13} />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
