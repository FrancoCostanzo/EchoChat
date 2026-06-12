import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner, Card } from '@heroui/react';
import { Bookmark, BookmarkX, Hash, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { messagesApi } from '@/lib/endpoints';
import UserAvatar from '@/components/UserAvatar';
import MessageBody from '@/components/MessageBody';
import { formatMessageTime } from '@/lib/dates';

export default function SavedMessagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
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

  const handleUnsave = async (msgId) => {
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
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blurple-500/15 text-blurple-400">
          <Bookmark size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">{t('saved.title')}</h1>
          <p className="truncate text-xs text-ink-200">{t('saved.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-ink-200">
            <Bookmark size={32} className="opacity-50" />
            <p className="text-sm">{t('saved.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((m) => (
              <Card
                key={m.id}
                className="group flex flex-col gap-2 p-4"
              >
                <div className="flex items-center gap-2">
                  <UserAvatar
                    user={{ display_name: m.sender_display_name, avatar_object_key: m.sender_avatar_key }}
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

                {m.body && (
                  <MessageBody
                    body={m.body}
                    bodyFormat={m.body_format}
                    variant="other"
                    size="sm"
                  />
                )}

                {m.saved_note && (
                  <p className="rounded-lg bg-ink-700 px-3 py-2 text-xs text-ink-100">
                    <span className="font-semibold">{t('saved.note')}: </span>
                    {m.saved_note}
                  </p>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start gap-1 text-blurple-400"
                  onPress={() => navigate(`/chat/${m.conversation_id}`)}
                >
                  <MessageSquare size={14} /> {t('saved.openConversation')}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
