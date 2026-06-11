import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@heroui/react';
import UserAvatar from '@/components/UserAvatar';
import CanvasPanel from '@/components/CanvasPanel';

/* ─────────────────────────────────────────────────────────
   PresenceAvatarStack — narrow avatar rail; expands to a
   floating member panel on demand (Spatial Canvas).
   Spec: docs/SPATIAL_CANVAS.md
   ───────────────────────────────────────────────────────── */

const PRESENCE_RING = {
  online: 'ring-echo-online',
  away: 'ring-echo-idle',
  busy: 'ring-echo-dnd',
  dnd: 'ring-echo-dnd',
  offline: 'ring-ink-400',
};

function MemberRow({ member }) {
  const name = member.display_name || member.username || '?';
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-ink-750/80">
      <UserAvatar
        user={{
          display_name: name,
          avatar_url: member.avatar_url,
          presence: member.presence,
        }}
        size="sm"
        showStatus
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-foreground">{name}</p>
        {member.role && member.role !== 'member' && (
          <p className="truncate text-[11px] capitalize text-ink-200">{member.role}</p>
        )}
      </div>
    </div>
  );
}

export default function PresenceAvatarStack({
  members = [],
  maxVisible = 5,
  loading = false,
  className = '',
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const visible = members.slice(0, maxVisible);
  const overflowCount = Math.max(0, members.length - maxVisible);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (loading || members.length === 0) return null;

  return (
    <div className={`relative hidden shrink-0 lg:flex ${className}`}>
      {/* Narrow rail */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('chat.viewMembers')}
        className="echo-press flex w-11 flex-col items-center gap-1.5 py-3"
      >
        {visible.map((member, i) => {
          const name = member.display_name || member.username || '?';
          const ring = PRESENCE_RING[member.presence] || PRESENCE_RING.offline;
          return (
            <span
              key={member.user_id || member.id}
              className={`relative rounded-full ring-2 ring-offset-1 ring-offset-transparent ${ring}`}
              style={{ marginTop: i > 0 ? -10 : 0, zIndex: visible.length - i }}
            >
              <UserAvatar
                user={{ display_name: name, presence: member.presence }}
                size="sm"
                className="scale-90"
              />
            </span>
          );
        })}
        {overflowCount > 0 && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-[10px] font-bold text-ink-100 ring-1 ring-white/10">
            +{overflowCount}
          </span>
        )}
      </button>

      {/* Floating member panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-full top-0 z-30 mr-3 w-64"
          >
            <CanvasPanel elevation={3} glass radius="lg" className="flex max-h-[min(420px,70vh)] flex-col">
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
                <h3 className="echo-display text-sm font-semibold">{t('chat.memberPanel')}</h3>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 min-w-0"
                  onPress={() => setOpen(false)}
                  aria-label={t('common.close')}
                >
                  <X size={14} />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-1 py-2">
                {members.map((member) => (
                  <MemberRow key={member.user_id || member.id} member={member} />
                ))}
              </div>
            </CanvasPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
