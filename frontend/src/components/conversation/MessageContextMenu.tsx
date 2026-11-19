import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { SPRING_BOUNCY } from '@/lib/motion';
import type { MenuAction, ContextMenuPos } from '@/components/conversation/shared';

/* ─────────────────────────────────────────────────────────
   MessageContextMenu — right-click / long-press action menu.
   Rendered in a portal, positioned at the cursor and clamped
   to the viewport. Closes on outside-click, Escape, scroll/resize.
   ───────────────────────────────────────────────────────── */
export default function MessageContextMenu({
  pos,
  onClose,
  quickEmojis,
  onEmoji,
  items,
}: {
  pos: ContextMenuPos;
  onClose: () => void;
  quickEmojis: string[];
  onEmoji: (emoji: string) => void;
  items: (MenuAction | false | null | undefined)[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ left: pos.x, top: pos.y, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    let left = pos.x;
    let top = pos.y;
    if (left + width + pad > window.innerWidth) left = window.innerWidth - width - pad;
    if (top + height + pad > window.innerHeight) top = Math.max(pad, pos.y - height);
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    setCoords({ left, top, ready: true });
  }, [pos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-0 z-80" aria-hidden />
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: coords.ready ? 1 : 0, scale: coords.ready ? 1 : 0.92, y: coords.ready ? 0 : 6 }}
        exit={{ opacity: 0, scale: 0.95, y: 4, transition: { duration: 0.12, ease: 'easeIn' } }}
        transition={SPRING_BOUNCY}
        style={{ left: coords.left, top: coords.top, transformOrigin: 'top left' }}
        className="echo-glass-strong pointer-events-auto fixed z-80 w-56 overflow-hidden rounded-2xl p-1.5"
      >
        {/* Quick reactions */}
        <div className="mb-1 flex items-center justify-between gap-0.5 px-1.5 pb-1.5">
          {quickEmojis.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => onEmoji(em)}
              className="echo-press flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-white/10"
            >
              {em}
            </button>
          ))}
        </div>
        <div className="mb-1 h-px bg-white/10" />
        {/* Actions */}
        {items.map((it) =>
          it ? (
            <button
              key={it.key}
              type="button"
              onClick={it.onClick}
              className={[
                'echo-press flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                it.danger
                  ? 'text-echo-dnd hover:bg-echo-dnd/15'
                  : 'text-ink-50 hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
            >
              <it.icon size={16} className="shrink-0" />
              <span className="truncate">{it.label}</span>
            </button>
          ) : null
        )}
      </motion.div>
    </>,
    document.body
  );
}
