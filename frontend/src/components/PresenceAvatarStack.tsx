import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, InputGroup, ScrollShadow, Tooltip } from '@heroui/react';
import type { ReactNode } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { useAuthStore } from '@/stores/authStore';
import type { MemberResponse } from '@/types/conversation';

const ACTIVE_PRESENCES = new Set(['online', 'away', 'busy', 'dnd']);
const PRESENCE_RANK: Record<string, number> = { online: 0, away: 1, busy: 2, dnd: 3 };
const ROLE_I18N: Record<string, string> = {
  owner: 'chat.roleOwner',
  admin: 'chat.roleAdmin',
  moderator: 'chat.roleModerator',
};
const ROLE_COLOR: Record<string, 'success' | 'accent' | 'default' | 'warning' | 'danger'> = {
  owner: 'warning',
  admin: 'accent',
  moderator: 'default',
};
const SEARCH_THRESHOLD = 6;

function memberName(member: MemberResponse): string {
  return member.display_name || member.username || '?';
}

function compareMembers(a: MemberResponse, b: MemberResponse): number {
  const aActive = ACTIVE_PRESENCES.has(a.presence || 'offline');
  const bActive = ACTIVE_PRESENCES.has(b.presence || 'offline');
  if (aActive !== bActive) return aActive ? -1 : 1;
  const rank = (PRESENCE_RANK[a.presence || ''] ?? 9) - (PRESENCE_RANK[b.presence || ''] ?? 9);
  if (rank) return rank;
  return memberName(a).localeCompare(memberName(b), undefined, { sensitivity: 'base' });
}

function SectionLabel({ children, count }: { children: ReactNode; count: number }) {
  return (
    <p className="px-2 pb-1 pt-3 first:pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-300 select-none">
      {children}
      <span className="ml-1 tabular-nums text-ink-400">· {count}</span>
    </p>
  );
}

function MemberRow({ member, isMe }: { member: MemberResponse; isMe: boolean }) {
  const { t } = useTranslation();
  const name = memberName(member);
  const presence = member.presence || 'offline';
  const roleKey = ROLE_I18N[member.role];

  return (
    <div
      className={[
        'flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors',
        isMe ? 'bg-accent/10' : 'hover:bg-ink-750',
      ].join(' ')}
    >
      {/* MemberResponse no trae una URL de avatar resuelta (sólo
          avatar_object_key) — igual que antes, cae siempre a las iniciales. */}
      <UserAvatar
        user={{ display_name: name, presence }}
        size="sm"
        showStatus
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{name}</p>
          {isMe && (
            <Chip size="sm" variant="soft" className="h-4 min-h-0 shrink-0 px-1.5 text-[10px]">
              {t('common.you')}
            </Chip>
          )}
        </div>
        <p className="truncate text-[11px] text-ink-300">
          {t(`settings.presenceOptions.${presence}`, presence)}
        </p>
      </div>
      {roleKey && (
        <Chip size="sm" variant="soft" color={ROLE_COLOR[member.role]} className="h-5 min-h-0 shrink-0">
          {t(roleKey)}
        </Chip>
      )}
    </div>
  );
}

interface PresenceAvatarStackProps {
  members?: MemberResponse[];
  maxVisible?: number;
  loading?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function PresenceAvatarStack({
  members = [],
  maxVisible = 10,
  loading = false,
  className = '',
  open = false,
  onOpenChange,
}: PresenceAvatarStackProps) {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => [...members].sort(compareMembers), [members]);
  const { active, offline, onlineCount, visible, overflowCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sorted.filter((m) => memberName(m).toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q))
      : sorted;
    return {
      active: filtered.filter((m) => ACTIVE_PRESENCES.has(m.presence || 'offline')),
      offline: filtered.filter((m) => !ACTIVE_PRESENCES.has(m.presence || 'offline')),
      onlineCount: members.filter((m) => m.presence === 'online').length,
      visible: sorted.slice(0, maxVisible),
      overflowCount: Math.max(0, sorted.length - maxVisible),
    };
  }, [sorted, members, query, maxVisible]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onOpenChange?.(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const showSearch = members.length >= SEARCH_THRESHOLD;
  const isMe = (member: MemberResponse) => member.user_id === currentUser?.id;

  if (!open && (loading || members.length === 0)) return null;

  // Collapsed rail — full-height opaque strip, top slot aligned with the chat header
  if (!open) {
    return (
      <aside
        className={[
          'echo-sidebar-bg hidden h-full w-14 shrink-0 flex-col items-center border-l border-divider lg:flex',
          className,
        ].filter(Boolean).join(' ')}
      >
        <div className="flex h-12 w-full shrink-0 items-center justify-center border-b border-white/8">
          <Tooltip>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => onOpenChange?.(true)}
              aria-label={t('chat.viewMembers')}
              className="h-8 w-8 min-w-0 rounded-lg text-ink-200 hover:bg-ink-750 hover:text-foreground"
            >
              <Users size={16} />
            </Button>
            <Tooltip.Content placement="left">
              <p>{t('chat.viewMembers')}</p>
            </Tooltip.Content>
          </Tooltip>
        </div>

        <ScrollShadow hideScrollBar className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 py-2">
          {visible.map((member) => {
            const name = memberName(member);
            const presence = member.presence || 'offline';
            return (
              <Tooltip key={member.user_id || member.id}>
                <button
                  type="button"
                  onClick={() => onOpenChange?.(true)}
                  className="echo-press rounded-full"
                  aria-label={name}
                >
                  <UserAvatar
                    user={{ display_name: name, presence }}
                    size="sm"
                    showStatus
                  />
                </button>
                <Tooltip.Content placement="left">
                  <p>{name} · {t(`settings.presenceOptions.${presence}`, presence)}</p>
                </Tooltip.Content>
              </Tooltip>
            );
          })}
          {overflowCount > 0 && (
            <Button
              isIconOnly
              variant="ghost"
              onPress={() => onOpenChange?.(true)}
              aria-label={t('chat.viewMembers')}
              className="h-8 w-8 min-w-0 rounded-full bg-ink-700 text-[11px] font-bold text-ink-100 ring-1 ring-divider hover:bg-ink-600 hover:text-foreground"
            >
              +{overflowCount}
            </Button>
          )}
        </ScrollShadow>

        {onlineCount > 0 && (
          <span className="mb-2.5 flex items-center gap-1 text-[10px] font-semibold tabular-nums text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {onlineCount}
          </span>
        )}
      </aside>
    );
  }

  // Expanded drawer — full height of the chat card so the header lines up with the chat header
  return (
    <motion.aside
      initial={{ x: 16 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'echo-sidebar-bg absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-divider shadow-2xl md:static md:z-0 md:w-72 md:shrink-0 md:shadow-none',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <div className="min-w-0">
          <h3 className="echo-display truncate text-[15px] font-semibold leading-tight">
            {t('chat.memberPanel')}
          </h3>
          <p className="text-[11px] text-ink-300">
            {members.length} {t('chat.members')}
            {onlineCount > 0 && (
              <>
                {' · '}
                <span className="font-medium text-success">
                  {t('chat.membersOnlineCount', { count: onlineCount })}
                </span>
              </>
            )}
          </p>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="h-7 w-7 min-w-0 shrink-0"
          onPress={() => onOpenChange?.(false)}
          aria-label={t('common.close')}
        >
          <X size={14} />
        </Button>
      </div>

      {showSearch && (
        <div className="border-b border-white/8 p-2.5">
          <InputGroup variant="secondary" className="bg-ink-900">
            <InputGroup.Prefix>
              <Search size={14} className="text-ink-200" />
            </InputGroup.Prefix>
            <InputGroup.Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (query ? setQuery('') : onOpenChange?.(false))}
              placeholder={t('chat.searchMembers')}
              aria-label={t('chat.searchMembers')}
            />
            {query && (
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={() => setQuery('')}
                  className="flex h-auto w-auto min-w-0 items-center p-0 text-ink-200 hover:bg-transparent hover:text-foreground"
                  aria-label={t('common.clear')}
                >
                  <X size={13} />
                </Button>
              </InputGroup.Suffix>
            )}
          </InputGroup>
        </div>
      )}

      <ScrollShadow className="min-h-0 flex-1 px-1.5 pb-2">
        {loading && members.length === 0 && (
          <div className="flex flex-col gap-2 px-1 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                <div className="echo-shimmer h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="echo-shimmer h-3 w-24 rounded-full" />
                  <div className="echo-shimmer h-2.5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && active.length === 0 && offline.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-ink-200">
            <Users size={22} className="opacity-40" />
            <p className="text-[13px]">{query ? t('chat.noMemberResults') : t('chat.emptyMembers')}</p>
          </div>
        )}

        {active.length > 0 && (
          <>
            <SectionLabel count={active.length}>{t('chat.membersActive')}</SectionLabel>
            {active.map((member) => (
              <MemberRow key={member.user_id || member.id} member={member} isMe={isMe(member)} />
            ))}
          </>
        )}
        {offline.length > 0 && (
          <>
            <SectionLabel count={offline.length}>{t('chat.membersOffline')}</SectionLabel>
            {offline.map((member) => (
              <MemberRow key={member.user_id || member.id} member={member} isMe={isMe(member)} />
            ))}
          </>
        )}
      </ScrollShadow>
    </motion.aside>
  );
}
