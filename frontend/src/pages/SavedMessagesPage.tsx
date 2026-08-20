import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button, Card } from '@heroui/react';
import { Bookmark, BookmarkX, Hash, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { messagesApi } from '@/lib/endpoints';
import { listItemEntry } from '@/lib/motion';
import UserAvatar from '@/components/UserAvatar';
import MessageBody from '@/components/MessageBody';
import CodeMessage from '@/components/CodeMessage';
import { formatMessageTime } from '@/lib/dates';
import type { SavedMessageResponse } from '@/types/message';

export default function SavedMessagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [items, setItems] = useState<SavedMessageResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await messagesApi.listSaved();
        if (active) setItems(data || []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleUnsave = async (msgId: string) => {
    setItems((prev) => prev.filter((m) => m.id !== msgId));
    try {
      await messagesApi.unsave(msgId);
    } catch {
      // best-effort; the optimistic removal stays
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-black/20 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Bookmark size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">{t('saved.title')}</h1>
          <p className="truncate text-xs text-ink-200">{t('saved.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex flex-col gap-2" role="status" aria-label={t('common.loading')}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-xl border border-white/5 bg-ink-800/50 p-4" style={{ opacity: 1 - i * 0.15 }}>
                <div className="flex items-center gap-2">
                  <div className="echo-shimmer h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex flex-col gap-1.5">
                    <div className="echo-shimmer h-3 w-28 rounded-full" />
                    <div className="echo-shimmer h-2.5 w-40 rounded-full" />
                  </div>
                </div>
                <div className="echo-shimmer h-3 w-3/4 rounded-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col items-center gap-2 py-16 text-ink-200"
          >
            <Bookmark size={32} className="opacity-50" />
            <p className="text-sm">{t('saved.empty')}</p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
            {items.map((m, i) => (
              <motion.div
                key={m.id}
                layout
                {...listItemEntry(i, reducedMotion)}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              >
              <Card
                className="group flex flex-col gap-2 p-4"
              >
                <div className="flex items-center gap-2">
                  {/* La API de mensajes guardados no manda una URL de avatar resuelta
                      (sólo sender_avatar_key, un object key sin presignar) — igual que
                      antes, este avatar cae siempre a las iniciales. */}
                  <UserAvatar
                    user={{ display_name: m.sender_display_name }}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.sender_display_name}</p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-ink-200">
                      <Hash size={10} />
                      {m.conversation_name || t('saved.directChat')}
                      {' · '}
                      {formatMessageTime(m.sent_at)}
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 min-w-0 text-ink-200 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={t('saved.remove')}
                    onPress={() => handleUnsave(m.id)}
                  >
                    <BookmarkX size={16} />
                  </Button>
                </div>

                {m.type === 'code' && m.body ? (
                  <CodeMessage message={m} variant="other" />
                ) : m.body ? (
                  <MessageBody
                    body={m.body}
                    bodyFormat={m.body_format ?? undefined}
                    variant="other"
                    size="sm"
                  />
                ) : null}

                {m.saved_note && (
                  <p className="rounded-lg bg-ink-700 px-3 py-2 text-xs text-ink-100">
                    <span className="font-semibold">{t('saved.note')}: </span>
                    {m.saved_note}
                  </p>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start gap-1 text-accent"
                  onPress={() => navigate(`/chat/${m.conversation_id}`)}
                >
                  <MessageSquare size={14} /> {t('saved.openConversation')}
                </Button>
              </Card>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
