import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { callsApi } from '@/lib/endpoints';
import { formatFullTime } from '@/lib/dates';

/* ─────────────────────────────────────────────────────────
   CallHistoryPanel — right-hand panel listing the calls of a
   conversation. Each row shows direction, outcome, date and
   duration, plus a shortcut to call again.
   ───────────────────────────────────────────────────────── */
function formatDuration(secs) {
  if (!secs || secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CallHistoryPanel({ conversationId, selfId, onClose, onCallAgain }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await callsApi.getByConversation(conversationId);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

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
          <Phone size={16} className="text-accent" />
          <h3 className="text-[15px] font-semibold">{t('call.history.title')}</h3>
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md px-2 py-2">
                <div className="echo-shimmer h-9 w-9 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="echo-shimmer h-3 w-28 rounded-full" />
                  <div className="echo-shimmer h-2.5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-ink-200">
            <Phone size={30} className="opacity-40" />
            <p className="text-[13px] font-medium">{t('call.history.empty')}</p>
            <p className="text-[12px] text-ink-300">{t('call.history.emptyHint')}</p>
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          {items.map((call) => {
            const outgoing = call.initiated_by === selfId;
            const isVideo = call.type === 'video';
            const missed = call.status === 'missed' || call.status === 'failed';
            const declined = call.status === 'rejected';
            const bad = missed || declined;

            const DirIcon = bad ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
            const duration = formatDuration(call.duration_seconds);

            let outcomeLabel;
            if (missed) outcomeLabel = outgoing ? t('call.timeline.noAnswer') : t('call.timeline.missed');
            else if (declined) outcomeLabel = t('call.timeline.declined');
            else outcomeLabel = duration || t('call.history.answered');

            return (
              <div
                key={call.id}
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-ink-750"
              >
                <div
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    bad ? 'bg-echo-dnd/15 text-echo-dnd' : 'bg-accent/15 text-accent',
                  ].join(' ')}
                >
                  <DirIcon size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    {isVideo && <Video size={13} className="shrink-0 text-ink-200" />}
                    <span className="truncate">
                      {outgoing ? t('call.history.outgoing') : t('call.history.incoming')}
                    </span>
                  </p>
                  <p className={`truncate text-[11px] ${bad ? 'text-echo-dnd' : 'text-ink-200'}`}>
                    {outcomeLabel} · {formatFullTime(call.initiated_at)}
                  </p>
                </div>

                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={() => onCallAgain?.(call.type)}
                  aria-label={t('call.history.callAgain')}
                  className="h-8 w-8 min-w-0 rounded-md text-ink-300 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 focus-visible:opacity-100"
                >
                  {isVideo ? <Video size={15} /> : <Phone size={15} />}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </motion.aside>
  );
}
