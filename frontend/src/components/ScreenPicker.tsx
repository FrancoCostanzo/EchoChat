import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button, Card } from '@heroui/react';
import { AppWindow, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { onScreenPickRequest, respondScreenPick } from '@/lib/desktop';
import { EASE_OUT, SPRING_SOFT } from '@/lib/motion';
import type { ShareSource } from '@/types/electron';

/**
 * Selector de pantalla o ventana para compartir en una llamada.
 *
 * En un navegador esto lo resuelve el diálogo nativo de `getDisplayMedia()`;
 * en Electron ese diálogo no existe, así que el main enumera las fuentes con
 * `desktopCapturer` y las manda acá para que el usuario elija.
 *
 * En la web nunca se monta nada: `onScreenPickRequest` es un no-op.
 */
export default function ScreenPicker() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [sources, setSources] = useState<ShareSource[] | null>(null);

  useEffect(() => onScreenPickRequest(setSources), []);

  const close = (sourceId: string | null) => {
    respondScreenPick(sourceId);
    setSources(null);
  };

  useEffect(() => {
    if (!sources) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sources]);

  const screens = sources?.filter((s) => s.kind === 'screen') ?? [];
  const windows = sources?.filter((s) => s.kind === 'window') ?? [];

  const renderGroup = (items: ShareSource[], title: string, Icon: typeof Monitor) => {
    if (items.length === 0) return null;

    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted">
          <Icon size={13} /> {title}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => close(source.id)}
              className="group flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-2 text-left transition-colors hover:border-accent hover:bg-accent-soft focus:outline-none focus-visible:border-accent"
            >
              <img
                src={source.thumbnail}
                alt=""
                className="aspect-video w-full rounded-lg bg-black/40 object-contain"
              />
              <span className="truncate text-xs text-foreground" title={source.name}>
                {source.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return createPortal(
    <AnimatePresence>
      {sources && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t('call.screenPicker.title')}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 0.18, ease: EASE_OUT }}
          onClick={(e) => { if (e.target === e.currentTarget) close(null); }}
        >
          <motion.div
            className="w-full max-w-2xl"
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={reducedMotion ? { duration: 0.01 } : SPRING_SOFT}
          >
            <Card className="echo-glass-strong overflow-hidden">
              <Card.Content className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-5">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {t('call.screenPicker.title')}
                  </h2>
                  <p className="text-sm text-muted">{t('call.screenPicker.subtitle')}</p>
                </div>

                {renderGroup(screens, t('call.screenPicker.screens'), Monitor)}
                {renderGroup(windows, t('call.screenPicker.windows'), AppWindow)}

                <div className="flex justify-end">
                  <Button variant="secondary" onPress={() => close(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </Card.Content>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
