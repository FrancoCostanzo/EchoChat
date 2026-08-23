import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@heroui/react';
import { Pin, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MessageResponse } from '@/types/message';

interface PinnedMessageBarProps {
  message: MessageResponse | null;
  onJump: (messageId: string) => void;
  onUnpin: () => void;
}

/* ─────────────────────────────────────────────────────────
   PinnedMessageBar — un chat sólo puede tener un mensaje
   fijado a la vez; esta barra lo muestra pegada debajo del
   header, igual para chats directos y grupos. Click para ir
   al mensaje, X para desfijarlo.
   ───────────────────────────────────────────────────────── */
export default function PinnedMessageBar({ message, onJump, onUnpin }: PinnedMessageBarProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 overflow-hidden border-b border-white/8 bg-ink-800/70 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] md:px-4">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Pin size={11} />
            </span>
            <button
              type="button"
              title={t('chat.jumpToOriginal')}
              onClick={() => onJump(message.id)}
              className="echo-press min-w-0 flex-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-ink-750/80"
            >
              <p className="truncate text-ink-100">
                <span className="font-semibold text-foreground">{message.sender_display_name}</span>
                {' — '}
                <span className="text-ink-200">{message.body || t('chat.attachedFile')}</span>
              </p>
            </button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={onUnpin}
              aria-label={t('chat.unpin')}
              className="h-auto w-auto min-w-0 rounded-full p-1 text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
            >
              <X size={14} />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
