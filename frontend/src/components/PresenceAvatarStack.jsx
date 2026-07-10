import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@heroui/react';
import UserAvatar from '@/components/UserAvatar';
import CanvasPanel from '@/components/CanvasPanel';
import { useAuthStore } from '@/stores/authStore';

const PRESENCE_DOT = {
  online:  'bg-success',
  away:    'bg-warning',
  busy:    'bg-danger',
  dnd:     'bg-danger',
  offline: 'bg-ink-500',
};

const ROLE_BADGE = {
  owner:     { label: 'Owner', className: 'bg-warning/15 text-warning border border-warning/25' },
  admin:     { label: 'Admin', className: 'bg-accent/15 text-accent border border-accent/25' },
  moderator: { label: 'Mod',   className: 'bg-secondary/15 text-secondary-foreground border border-white/10' },
};

const ACTIVE_PRESENCES = new Set(['online', 'away', 'busy', 'dnd']);

function SectionLabel({ children, count }) {
  return (
    <p className="px-2 pb-0.5 pt-3 first:pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-400 select-none">
      {children} · {count}
    </p>
  );
}

function MemberRow({ member, isMe }) {
  const { t } = useTranslation();
  const name = member.display_name || member.username || '?';
  const presence = member.presence || 'offline';
  const roleBadge = ROLE_BADGE[member.role];

  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors ${isMe ? 'bg-accent/6' : 'hover:bg-ink-750/70'}`}>
      <UserAvatar
        user={{ display_name: name, avatar_url: member.avatar_url, presence }}
        size="sm"
        showStatus
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-medium leading-tight text-foreground">{name}</p>
          {isMe && (
            <span className="shrink-0 rounded-full bg-ink-600 px-1.5 py-0.5 text-[10px] font-semibold text-ink-200">
              {t('common.you', 'Tú')}
            </span>
          )}
        </div>
        <p className="text-[11px] capitalize text-ink-300">
          {t(`settings.presenceOptions.${presence}`, presence)}
        </p>
      </div>
      {roleBadge && (
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${roleBadge.className}`}>
          {roleBadge.label}
        </span>
      )}
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
  const currentUser = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const visible = members.slice(0, maxVisible);
  const overflowCount = Math.max(0, members.length - maxVisible);

  const { active, offline, onlineCount } = useMemo(() => {
    const active  = members.filter((m) => ACTIVE_PRESENCES.has(m.presence));
    const offline = members.filter((m) => !ACTIVE_PRESENCES.has(m.presence));
    const onlineCount = members.filter((m) => m.presence === 'online').length;
    return { active, offline, onlineCount };
  }, [members]);

  useEffect(() => {
    if (!open) return;
    const onKey   = (e) => { if (e.key === 'Escape') setOpen(false); };
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
      {/* ── Narrow avatar rail ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('chat.viewMembers')}
        className={[
          'echo-press flex w-11 flex-col items-center gap-1 py-3 transition-colors duration-150',
          open ? 'bg-ink-750/40' : 'hover:bg-ink-750/20',
        ].join(' ')}
      >
        {visible.map((member, i) => {
          const name    = member.display_name || member.username || '?';
          const presence = member.presence || 'offline';
          const dotColor = PRESENCE_DOT[presence] || PRESENCE_DOT.offline;
          const isMe    = member.user_id === currentUser?.id;

          return (
            <span
              key={member.user_id || member.id}
              className={`relative inline-flex rounded-full ${isMe ? 'ring-2 ring-accent ring-offset-1 ring-offset-ink-900' : ''}`}
              style={{ marginTop: i > 0 ? -6 : 0, zIndex: visible.length - i }}
            >
              <UserAvatar
                user={{ display_name: name, avatar_url: member.avatar_url, presence }}
                size="sm"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 ${dotColor}`}
              />
            </span>
          );
        })}
        {overflowCount > 0 && (
          <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink-700/90 text-[10px] font-bold text-ink-100 ring-1 ring-white/10">
            +{overflowCount}
          </span>
        )}
      </button>

      {/* ── Floating member panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: 10, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-full top-0 z-30 mr-2 w-72"
          >
            <CanvasPanel elevation={3} glass radius="lg" className="flex max-h-[min(520px,72vh)] flex-col">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-700/60">
                    <Users size={13} className="text-ink-200" />
                  </div>
                  <div>
                    <h3 className="echo-display text-sm font-semibold leading-tight">{t('chat.memberPanel')}</h3>
                    <p className="text-[11px] text-ink-300">
                      {members.length} {t('chat.members')}
                      {onlineCount > 0 && (
                        <>
                          {' · '}
                          <span className="text-success">
                            {t('chat.membersOnlineCount', { count: onlineCount })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 min-w-0 shrink-0"
                  onPress={() => setOpen(false)}
                  aria-label={t('common.close')}
                >
                  <X size={14} />
                </Button>
              </div>

              {/* Member list */}
              <div className="flex-1 overflow-y-auto px-1.5 pb-2">
                {active.length > 0 && (
                  <>
                    <SectionLabel count={active.length}>{t('chat.membersActive')}</SectionLabel>
                    {active.map((member) => (
                      <MemberRow
                        key={member.user_id || member.id}
                        member={member}
                        isMe={member.user_id === currentUser?.id}
                      />
                    ))}
                  </>
                )}
                {offline.length > 0 && (
                  <>
                    <SectionLabel count={offline.length}>{t('chat.membersOffline')}</SectionLabel>
                    {offline.map((member) => (
                      <MemberRow
                        key={member.user_id || member.id}
                        member={member}
                        isMe={member.user_id === currentUser?.id}
                      />
                    ))}
                  </>
                )}
              </div>
            </CanvasPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
