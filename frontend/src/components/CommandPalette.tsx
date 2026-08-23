import { useState, useEffect, useMemo, useRef, useCallback, type ComponentType, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Bell,
  Settings,
  Compass,
  Bookmark,
  Megaphone,
  Shield,
  Hash,
  AtSign,
  Search,
  CornerDownLeft,
  Phone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';

/* ─────────────────────────────────────────────────────────
   CommandPalette — Ctrl/Cmd+K quick navigation overlay.
   Primary nav for power users: jump to any conversation or
   app section without touching the mouse.
   ───────────────────────────────────────────────────────── */

type PaletteIcon = ComponentType<{ size?: number; className?: string }>;

interface NavItemDef {
  id: string;
  icon: PaletteIcon;
  labelKey: string;
  path: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'nav-chats', icon: MessageSquare, labelKey: 'sidebar.chats', path: '/chat' },
  { id: 'nav-contacts', icon: Users, labelKey: 'sidebar.contacts', path: '/contacts' },
  { id: 'nav-calls', icon: Phone, labelKey: 'sidebar.calls', path: '/calls' },
  { id: 'nav-explore', icon: Compass, labelKey: 'sidebar.explore', path: '/channels' },
  { id: 'nav-broadcasts', icon: Megaphone, labelKey: 'sidebar.broadcasts', path: '/broadcasts' },
  { id: 'nav-saved', icon: Bookmark, labelKey: 'sidebar.saved', path: '/saved' },
  { id: 'nav-notifications', icon: Bell, labelKey: 'sidebar.notifications', path: '/notifications' },
  { id: 'nav-admin', icon: Shield, labelKey: 'sidebar.admin', path: '/admin', adminOnly: true },
  { id: 'nav-settings', icon: Settings, labelKey: 'sidebar.settings', path: '/settings' },
];

interface NavResultItem extends NavItemDef {
  type: 'nav';
  label: string;
}

interface ConversationResultItem {
  id: string;
  type: 'conversation';
  label: string;
  isDirect: boolean;
  unread: number;
  convId: string;
}

type PaletteResult = NavResultItem | ConversationResultItem;

export default function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { conversations, setActiveConversation } = useChatStore();

  const canAdmin = (user?.roles || []).includes('super_admin')
    || (user?.permissions || []).some((p) => p.startsWith('admin.'));

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const results = useMemo<PaletteResult[]>(() => {
    const navResults: NavResultItem[] = NAV_ITEMS
      .filter((item) => !item.adminOnly || canAdmin)
      .filter((item) => !q || t(item.labelKey).toLowerCase().includes(q))
      .map((item) => ({ ...item, type: 'nav', label: t(item.labelKey) }));

    const convResults: ConversationResultItem[] = conversations
      .filter((c) => {
        const name = (c.display_name || c.name || '').toLowerCase();
        return !q || name.includes(q);
      })
      .slice(0, q ? 12 : 6)
      .map((c) => ({
        id: `conv-${c.id}`,
        type: 'conversation',
        label: c.display_name || c.name || t('sidebar.noName'),
        isDirect: c.type === 'direct',
        unread: c.unread_count || 0,
        convId: c.id,
      }));

    return [...convResults, ...navResults];
  }, [q, conversations, t, canAdmin]);

  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  const select = useCallback(
    (item: PaletteResult) => {
      setOpen(false);
      if (item.type === 'conversation') {
        setActiveConversation(item.convId);
        navigate(`/chat/${item.convId}`);
      } else {
        navigate(item.path);
      }
    },
    [navigate, setActiveConversation],
  );

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      select(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    const el = listRef.current?.children[activeIndex];
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-4 pt-[18vh] backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('commandPalette.title')}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="echo-glass-strong w-full max-w-[560px] overflow-hidden rounded-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
              <Search size={18} className="shrink-0 text-ink-200" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t('commandPalette.placeholder')}
                aria-label={t('commandPalette.placeholder')}
                className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-ink-200"
              />
              <kbd className="shrink-0 rounded-md border border-ink-400/40 bg-ink-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-ink-200">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} role="listbox" className="max-h-[46vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-[13px] text-ink-200">
                  {t('commandPalette.noResults')}
                </p>
              )}
              {results.map((item, i) => {
                const isActive = i === activeIndex;
                const Icon =
                  item.type === 'nav' ? item.icon : item.isDirect ? AtSign : Hash;
                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(item)}
                    className={[
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors',
                      isActive
                        ? 'echo-grad-brand-soft echo-ring-soft text-foreground'
                        : 'text-ink-100',
                    ].join(' ')}
                  >
                    <Icon size={16} className={isActive ? 'text-accent' : 'text-ink-200'} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.type === 'conversation' && item.unread > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-echo-dnd px-1.5 text-[10px] font-bold text-white">
                        {item.unread > 99 ? '99+' : item.unread}
                      </span>
                    )}
                    {item.type === 'nav' && (
                      <span className="text-[11px] uppercase tracking-wider text-ink-300">
                        {t('commandPalette.navigation')}
                      </span>
                    )}
                    {isActive && <CornerDownLeft size={13} className="shrink-0 text-ink-200" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
