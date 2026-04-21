import { MessageSquare, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function EmptyChat() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-ink-700 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-ink-600 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <MessageSquare size={52} strokeWidth={1.5} className="text-blurple-400" />
        </div>
        <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-blurple-500 shadow-lg">
          <Sparkles size={18} className="text-white" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="max-w-md"
      >
        <h2 className="text-2xl font-extrabold text-foreground">{t('common.appName')}</h2>
        <p className="mt-2 text-[15px] text-ink-100">{t('chat.empty')}</p>
      </motion.div>
    </div>
  );
}
