import { MessageSquare, Sparkles, Plus, Compass } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function EmptyChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="echo-grad-brand-soft flex h-28 w-28 items-center justify-center rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <MessageSquare size={52} strokeWidth={1.5} className="text-accent" />
        </div>
        <div className="echo-grad-brand echo-glow-md absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full">
          <Sparkles size={18} className="echo-on-accent" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="max-w-md"
      >
        <h2 className="echo-display text-2xl font-semibold text-foreground">{t('common.appName')}</h2>
        <p className="mt-2 text-[15px] text-ink-100">{t('chat.empty')}</p>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.18 }}
        className="flex flex-wrap items-center justify-center gap-2"
      >
        <button
          type="button"
          onClick={() => navigate('/chat/new')}
          className="echo-press echo-grad-brand echo-glow-md echo-on-accent flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
        >
          <Plus size={15} strokeWidth={2.5} />
          {t('sidebar.newChat')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/channels')}
          className="echo-press flex items-center gap-2 rounded-full border border-ink-400/40 bg-ink-800/70 px-4 py-2 text-[13px] font-semibold text-ink-50 transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <Compass size={15} strokeWidth={2.5} />
          {t('sidebar.explore')}
        </button>
      </motion.div>

      {/* Keyboard hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="flex items-center gap-1.5 text-[12px] text-ink-300"
      >
        {t('chat.emptyHint')}
        <kbd className="rounded-md border border-ink-400/40 bg-ink-800/80 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-ink-100">
          {isMac ? '⌘' : 'Ctrl'}
        </kbd>
        <kbd className="rounded-md border border-ink-400/40 bg-ink-800/80 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-ink-100">
          K
        </kbd>
      </motion.p>
    </div>
  );
}
