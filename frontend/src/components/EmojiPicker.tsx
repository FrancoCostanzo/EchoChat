import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from '@heroui/react';
import { Smile } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

// El `Picker` de emoji-mart declara sus tipos como una clase propia que no
// redeclara las ~300 propiedades del DOM real, aunque en runtime SÍ es un
// custom element (extiende HTMLElement de verdad) — por eso el cast al
// insertarlo/leerlo como nodo del DOM más abajo.

// emoji-mart core is loaded lazily (see below) so its ~1 MB dataset stays out
// of the main bundle and only downloads when the picker first opens. We skip
// @emoji-mart/react (peer deps cap at React 18); the core works with React 19.

/* ─────────────────────────────────────────────────────────
   EmojiPicker — full emoji library (categories, search, skin
   tones, frequently used) powered by emoji-mart. Renders the
   OS-native emoji set, so no image sprites are downloaded.
   onPick receives the selected emoji character.
   ───────────────────────────────────────────────────────── */

const SUPPORTED_LOCALES = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'ja', 'zh'];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  open: boolean;
  onOpenChange: (next: boolean | ((prev: boolean) => boolean)) => void;
}

export default function EmojiPicker({ onPick, open, onOpenChange }: EmojiPickerProps) {
  const { t, i18n } = useTranslation();
  const mode = useThemeStore((s) => s.mode);
  const setOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    onOpenChange(typeof next === 'function' ? next(open) : next);
  }, [open, onOpenChange]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);

  // The emoji-mart element is expensive to build, so we build it once and reuse
  // it across opens (re-parenting a detached node is cheap and keeps its warm
  // render/scroll state). It's only rebuilt when the theme or locale changes.
  const pickerRef = useRef<HTMLElement | null>(null);
  const builtConfigRef = useRef('');

  // Keep the latest onPick without re-mounting the picker on every parent render.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Build (once) or reuse the emoji-mart element while the popover is open.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const lang = (i18n.language || 'en').slice(0, 2);
    const locale = SUPPORTED_LOCALES.includes(lang) ? lang : 'en';
    const theme = mode === 'system' ? 'auto' : mode;
    const config = `${theme}|${locale}`;

    const attach = (el: HTMLElement) => {
      if (cancelled || !mountRef.current) return;
      if (el.parentNode !== mountRef.current) mountRef.current.appendChild(el);
    };

    // Reuse the cached element when the theme/locale hasn't changed.
    if (pickerRef.current && builtConfigRef.current === config) {
      attach(pickerRef.current);
      return () => { cancelled = true; };
    }

    (async () => {
      const [pickerMod, dataMod] = await Promise.all([
        import('emoji-mart'),
        import('@emoji-mart/data'),
      ]);
      if (cancelled) return;
      pickerRef.current = new pickerMod.Picker({
        data: dataMod.default,
        onEmojiSelect: (emoji: { native: string }) => onPickRef.current?.(emoji.native),
        theme,
        locale,
        set: 'native',
        previewPosition: 'none',
        skinTonePosition: 'search',
        navPosition: 'top',
        perLine: 8,
        maxFrequentRows: 2,
        // No dynamicWidth: it measures the container on mount, which is wrong
        // while the popover is still animating — the picker uses its own
        // intrinsic width (perLine × emojiSize) instead.
        emojiButtonSize: 34,
        emojiSize: 22,
        autoFocus: true,
      }) as unknown as HTMLElement;
      builtConfigRef.current = config;
      attach(pickerRef.current);
    })();

    // On close we leave the element cached (detached) in pickerRef for reuse.
    return () => { cancelled = true; };
  }, [open, mode, i18n.language]);

  return (
    <div className="relative" ref={rootRef}>
      <Tooltip>
        <Button
          isIconOnly
          variant="ghost"
          onPress={() => setOpen((p) => !p)}
          aria-label={t('chat.emoji')}
          aria-expanded={open}
          className="flex h-9 w-9 min-w-0 shrink-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          <Smile size={18} />
        </Button>
        <Tooltip.Content placement="top">
          <p>{t('chat.emoji')}</p>
        </Tooltip.Content>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute bottom-11 right-0 z-40 w-max max-w-[calc(100vw-1.5rem)] rounded-xl shadow-2xl"
          >
            {/* emoji-mart mounts its themed, self-contained picker here.
                It sizes itself to its intrinsic width (no wrapper constraint). */}
            <div ref={mountRef} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
