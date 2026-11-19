import { motion } from 'framer-motion';
import { Phone, PhoneMissed, Video as VideoIcon } from 'lucide-react';
import { formatMessageTime } from '@/lib/dates';
import type { ChatMessage } from '@/stores/chatStore';
import type { TFunc, CallEventMetadata } from '@/components/conversation/shared';

/* Centered pill summarizing a finished/missed call. Doubles as chat history. */
export default function CallEventRow({
  message,
  currentUserId,
  shouldAnimate,
  reducedMotion,
  t,
}: {
  message: ChatMessage;
  currentUserId?: string | null;
  shouldAnimate: boolean;
  reducedMotion: boolean | null;
  t: TFunc;
}) {
  const meta = (message.metadata as CallEventMetadata | null) || {};
  const isVideo = meta.call_type === 'video';
  const outgoing = meta.initiated_by === currentUserId;
  const missed = meta.outcome === 'missed';
  const declined = meta.outcome === 'declined';

  let label;
  if (missed) label = outgoing ? t('call.timeline.noAnswer') : t('call.timeline.missed');
  else if (declined) label = outgoing ? t('call.timeline.declined') : t('call.timeline.declinedByYou');
  else label = isVideo ? t('call.timeline.videoCall') : t('call.timeline.voiceCall');

  const secs = meta.duration_seconds || 0;
  const duration = secs > 0
    ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
    : null;

  const Icon = missed ? PhoneMissed : isVideo ? VideoIcon : Phone;
  const danger = missed || declined;

  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={shouldAnimate && !reducedMotion ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-center px-4 py-1.5"
    >
      <div
        className={[
          'flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] shadow-sm backdrop-blur-sm',
          danger
            ? 'border-echo-dnd/30 bg-echo-dnd/10 text-echo-dnd'
            : 'border-white/10 bg-ink-800/70 text-ink-100',
        ].join(' ')}
      >
        <Icon size={13} className="shrink-0" />
        <span className="font-medium">{label}</span>
        {duration && <span className="text-ink-200">· {duration}</span>}
        <span className="text-ink-300">· {formatMessageTime(message.sent_at)}</span>
      </div>
    </motion.div>
  );
}
