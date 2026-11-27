import { useState, useRef, useEffect, useLayoutEffect, useCallback, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@heroui/react';
import {
  Paperclip,
  CalendarClock,
  Loader,
  Image,
  Film,
  FileText,
  BarChart3,
  Code2,
  MapPin,
  Contact,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MenuItem {
  icon: LucideIcon;
  label: string;
  ref?: RefObject<HTMLInputElement | null>;
  accept?: string;
  action?: () => void;
}

/* ─────────────────────────── File Picker Menu ─────────────────────────── */
export default function FilePickerMenu({
  onPick,
  onPoll,
  onCode,
  onSchedule,
  onLocation,
  onContact,
  disabled,
  uploading,
  open,
  onOpenChange,
}: {
  onPick: (file: File) => void;
  onPoll?: () => void;
  onCode?: () => void;
  onSchedule?: () => void;
  onLocation?: () => void;
  onContact?: () => void;
  disabled?: boolean;
  uploading?: boolean;
  open: boolean;
  onOpenChange: (next: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const { t } = useTranslation();
  const setOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    onOpenChange(typeof next === 'function' ? next(open) : next);
  }, [open, onOpenChange]);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const docRef   = useRef<HTMLInputElement>(null);

  const pick = (ref: RefObject<HTMLInputElement | null>) => { setOpen(false); ref.current?.click(); };

  const FILE_ITEMS: MenuItem[] = [
    { icon: Image,    label: t('chat.attachImage'),    ref: imageRef, accept: 'image/*' },
    { icon: Film,     label: t('chat.attachVideo'),    ref: videoRef, accept: 'video/*' },
    { icon: FileText, label: t('chat.attachDocument'), ref: docRef,   accept: '*/*' },
  ];

  const MENU_ITEMS: MenuItem[] = [
    ...FILE_ITEMS,
    ...(onCode ? [{ icon: Code2, label: t('code.sendTitle'), action: onCode }] : []),
    ...(onPoll ? [{ icon: BarChart3, label: t('poll.create'), action: onPoll }] : []),
    ...(onLocation ? [{ icon: MapPin, label: t('location.share'), action: onLocation }] : []),
    ...(onContact ? [{ icon: Contact, label: t('contactShare.share'), action: onContact }] : []),
    ...(onSchedule ? [{ icon: CalendarClock, label: t('schedule.action'), action: onSchedule }] : []),
  ];

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? MENU_ITEMS.length * 40;
    const menuWidth = menu?.offsetWidth ?? 192;
    const gap = 8;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Prefer opening above the attach button (composer sits at the bottom on mobile)
    let top = rect.top - menuHeight - gap;
    if (top < gap) {
      top = rect.bottom + gap;
      if (top + menuHeight > vh - gap) {
        top = Math.max(gap, vh - menuHeight - gap);
      }
    }

    let left = rect.left;
    if (left + menuWidth > vw - gap) left = vw - menuWidth - gap;
    if (left < gap) left = gap;

    setMenuPos({ left, top });
  }, [MENU_ITEMS.length]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, [setOpen]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    requestAnimationFrame(updateMenuPosition);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler, { passive: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // The portal must stay mounted while AnimatePresence runs the exit animation;
  // the `open` conditional lives inside it so closing doesn't unmount abruptly.
  const menu = createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: menuPos ? 1 : 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: menuPos?.left ?? -9999,
            top: menuPos?.top ?? -9999,
            visibility: menuPos ? 'visible' : 'hidden',
            zIndex: 9999,
          }}
          className="min-w-48 overflow-hidden rounded-lg border border-ink-400/40 bg-ink-850 shadow-xl"
        >
          {MENU_ITEMS.map(({ icon: Icon, label, ref, action }) => (
            <Button
              key={label}
              variant="ghost"
              onPress={() => {
                setOpen(false);
                if (action) action();
                else if (ref) pick(ref);
              }}
              className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-3 py-2 text-[14px] text-ink-50 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </Button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  return (
    <div className="relative shrink-0" ref={rootRef}>
      {FILE_ITEMS.map(({ ref, accept }) => (
        <input
          key={accept}
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onPick(f); e.target.value = ''; } }}
        />
      ))}

      <div ref={triggerRef} className="shrink-0">
        <Button
          isIconOnly
          variant="ghost"
          isDisabled={disabled}
          onPress={toggleOpen}
          aria-label={t('chat.attachFile')}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex h-9 w-9 min-w-0 shrink-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          {uploading ? <Loader size={18} className="animate-spin" /> : <Paperclip size={18} />}
        </Button>
      </div>

      {menu}
    </div>
  );
}
