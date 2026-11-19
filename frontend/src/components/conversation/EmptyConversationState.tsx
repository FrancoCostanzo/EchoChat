import { motion, useReducedMotion } from 'framer-motion';
import { Hash, Users, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import { EASE_OUT } from '@/lib/motion';
import type { ConversationResponse } from '@/types/conversation';

/* ─────────────────────────────────────────────────────────
   EmptyConversationState — friendly hero for chats with no
   messages yet. One-tap "say hi" sends a wave to break the ice.
   ───────────────────────────────────────────────────────── */
export default function EmptyConversationState({
  conversation,
  convName,
  onSayHi,
  sending,
}: {
  conversation: ConversationResponse;
  convName: string;
  onSayHi: () => void;
  sending: boolean;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const isDirect = conversation.type === 'direct';
  const isGroup = conversation.type === 'group';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <div className="relative">
        {isDirect ? (
          <UserAvatar
            user={{ display_name: convName, avatar_url: conversation.other_avatar_url }}
            size="lg"
            className="scale-125"
          />
        ) : (
          <div className="echo-grad-brand echo-glow-md echo-on-accent flex h-20 w-20 items-center justify-center rounded-3xl">
            {isGroup
              ? <Users size={36} strokeWidth={1.8} />
              : <Hash size={36} strokeWidth={1.8} />}
          </div>
        )}
        <motion.span
          aria-hidden
          animate={reducedMotion ? undefined : { rotate: [0, 16, -9, 16, 0] }}
          transition={{ duration: 1.1, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY, repeatDelay: 2.4 }}
          className="absolute -bottom-3 -right-4 origin-[70%_70%] text-3xl drop-shadow-md"
        >
          👋
        </motion.span>
      </div>

      <div>
        <h3 className="echo-display text-2xl font-semibold">{t('chat.noMessagesTitle')}</h3>
        <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-100">
          {isDirect
            ? t('chat.noMessagesDirect', { name: convName })
            : isGroup
              ? t('chat.noMessagesGroup')
              : t('chat.noMessagesChannel', { name: convName })}
        </p>
      </div>

      <button
        type="button"
        onClick={onSayHi}
        disabled={sending}
        className="echo-press echo-grad-brand echo-glow-md echo-on-accent pointer-events-auto flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold disabled:opacity-60"
      >
        {sending
          ? <Loader size={16} className="animate-spin" />
          : <span className="text-lg leading-none">👋</span>}
        {t('chat.sayHi')}
      </button>
    </motion.div>
  );
}
