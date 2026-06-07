import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Input } from '@heroui/react';
import { Plus, X, Trash2, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pollsApi } from '@/lib/endpoints';

const MAX_OPTIONS = 10;

export default function CreatePollModal({ conversationId, onClose }) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isMultiple, setIsMultiple] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const setOption = (i, value) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  const addOption = () =>
    setOptions((prev) => (prev.length >= MAX_OPTIONS ? prev : [...prev, '']));
  const removeOption = (i) =>
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && cleanOptions.length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await pollsApi.create({
        conversation_id: conversationId,
        question: question.trim(),
        options: cleanOptions,
        is_anonymous: isAnonymous,
        is_multiple: isMultiple,
      });
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.34, 1, 0.64, 1] }}
        className="relative z-10 mx-4 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-md bg-ink-850 shadow-2xl ring-1 ring-black/40"
      >
        <div className="flex items-center justify-between border-b border-black/20 px-4 py-3">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <BarChart3 size={16} /> {t('poll.create')}
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-200 hover:bg-ink-750 hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-200">{t('poll.question')}</label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('poll.questionPlaceholder')} maxLength={500} autoFocus />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-ink-200">{t('poll.options')}</label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`${t('poll.option')} ${i + 1}`}
                  maxLength={300}
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-200 hover:bg-ink-750 hover:text-echo-dnd">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <button onClick={addOption} className="flex items-center gap-1 self-start text-sm text-blurple-400 hover:text-blurple-300">
                <Plus size={14} /> {t('poll.addOption')}
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isMultiple} onChange={(e) => setIsMultiple(e.target.checked)} className="accent-blurple-500" />
            {t('poll.allowMultiple')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="accent-blurple-500" />
            {t('poll.makeAnonymous')}
          </label>
        </div>

        <div className="border-t border-black/20 p-3">
          <Button className="w-full" isDisabled={!canSubmit} isPending={busy} onPress={handleSubmit}>
            {t('poll.create')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
