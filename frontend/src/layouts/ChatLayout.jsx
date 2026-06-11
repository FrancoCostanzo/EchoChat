import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, InputGroup, TextField, Tooltip } from '@heroui/react';
import {
  MessageSquare,
  Users,
  Bell,
  Settings,
  LogOut,
  Search,
  Plus,
  Hash,
  AtSign,
  User,
  Palette,
  Globe,
  Shield,
  Wifi,
  ArrowLeft,
  Cog,
  Mic,
  Headphones,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';
import ServerOrbitDock from '@/components/ServerOrbitDock';
import CommandPalette from '@/components/CommandPalette';
import CanvasPanel from '@/components/CanvasPanel';
import { formatMessageTime } from '@/lib/dates';

const CONTENT_TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] };

/* ─────────────────────────────────────────────────────────
   ConversationItem — row in the channel/DM list
   ───────────────────────────────────────────────────────── */
function ConversationItem({ conversation, isActive, onClick, t, animIndex = 0 }) {
  const isDirect = conversation.type === 'direct';
  const name = conversation.display_name || conversation.name || t('sidebar.noName');
  const lastMsg = conversation.last_message_body;
  const time = conversation.last_message_at;
  const unread = conversation.unread_count || 0;
  const hasUnread = unread > 0;

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut', delay: Math.min(animIndex, 12) * 0.015 }}
      className={[
        'group relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
        isActive
          ? 'echo-grad-brand-soft echo-ring-soft text-foreground'
          : hasUnread
            ? 'text-foreground hover:bg-ink-750'
            : 'text-ink-100 hover:bg-ink-750 hover:text-foreground',
      ].join(' ')}
    >
      {/* Active / unread bar indicator */}
      {(hasUnread || isActive) && (
        <span className={`absolute -left-2 top-1/2 -translate-y-1/2 rounded-r-full bg-accent transition-all ${isActive ? 'h-6 w-1' : 'h-2 w-1'}`} />
      )}

      {/* Avatar / icon */}
      <div className="relative shrink-0">
        {isDirect ? (
          <UserAvatar
            user={{
              display_name: name,
              presence: conversation.member_presence,
              avatar_url: conversation.other_avatar_url,
            }}
            size="sm"
            showStatus
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-ink-100 group-hover:bg-ink-600">
            <Hash size={16} strokeWidth={2.5} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-[15px] leading-tight ${hasUnread || isActive ? 'font-semibold' : 'font-medium'}`}
          >
            {name}
          </span>
          {time && (
            <span className="shrink-0 text-[10px] text-ink-200">
              {formatMessageTime(time)}
            </span>
          )}
        </div>
        {lastMsg && (
          <p className="truncate text-xs text-ink-200">{lastMsg}</p>
        )}
      </div>

      {hasUnread && (
        <span className="ml-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-echo-dnd px-1.5 text-[10px] font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────
   UserPanel — bottom of channel list, Discord-style
   ───────────────────────────────────────────────────────── */
function UserPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex items-center gap-2 bg-ink-850 px-2 py-2">
      <Button
        variant="ghost"
        onPress={() => navigate('/settings/profile')}
        className="flex h-auto min-w-0 flex-1 items-center justify-start gap-2 rounded-md px-1 py-1 transition-colors hover:bg-ink-800"
      >
        <UserAvatar user={user} size="sm" showStatus />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-semibold leading-tight">{user?.display_name}</p>
          <p className="truncate text-[11px] text-ink-200">
            {user?.presence_message || `@${user?.username}`}
          </p>
        </div>
      </Button>

      <div className="flex items-center">
        <Tooltip delay={0} placement="top">
          <Button isIconOnly size="sm" variant="ghost" className="h-8 w-8 min-w-0">
            <Mic size={16} className="text-ink-100" />
          </Button>
          <Tooltip.Content><p>Mic</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0} placement="top">
          <Button isIconOnly size="sm" variant="ghost" className="h-8 w-8 min-w-0">
            <Headphones size={16} className="text-ink-100" />
          </Button>
          <Tooltip.Content><p>Audio</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0} placement="top">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="h-8 w-8 min-w-0"
            onPress={() => navigate('/settings/profile')}
          >
            <Cog size={16} className="text-ink-100" />
          </Button>
          <Tooltip.Content><p>{t('sidebar.settings')}</p></Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ChatSidebar — channel/DM list
   ───────────────────────────────────────────────────────── */
function ChatSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversations, activeConversationId, setActiveConversation } = useChatStore();
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const filtered = conversations.filter((c) => {
    if (!query) return true;
    const name = (c.display_name || c.name || '').toLowerCase();
    const lastMsg = (c.last_message_body || '').toLowerCase();
    return name.includes(query) || lastMsg.includes(query);
  });

  // Split into direct (DMs) and channels/groups
  const dms = filtered.filter((c) => c.type === 'direct');
  const rooms = filtered.filter((c) => c.type !== 'direct');

  const handleConversationClick = useCallback(
    (id) => {
      setActiveConversation(id);
      navigate(`/chat/${id}`);
    },
    [setActiveConversation, navigate],
  );

  return (
    <div className="echo-sidebar-bg flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-4 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={18} className="shrink-0 text-accent" />
          <h2 className="echo-display truncate text-2xl font-semibold tracking-tight">{t('sidebar.chats')}</h2>
        </div>
        <Tooltip delay={0} placement="bottom">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="h-7 w-7 min-w-0"
            onPress={() => navigate('/chat/new')}
          >
            <Plus size={16} />
          </Button>
          <Tooltip.Content><p>{t('sidebar.newChat')}</p></Tooltip.Content>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="px-2 pt-2">
        <div className="w-full">
          <TextField fullWidth aria-label={t('sidebar.searchConversation')}>
            <InputGroup fullWidth variant="secondary" className="h-8 rounded-md bg-ink-900 text-[13px]">
              <InputGroup.Prefix>
                <Search size={13} className="text-ink-200" />
              </InputGroup.Prefix>
              <InputGroup.Input
                id="echo-search-input"
                placeholder={t('sidebar.searchConversation')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    variant="ghost"
                    onPress={() => setSearch('')}
                    aria-label={t('common.clear')}
                    className="flex h-4 w-4 min-w-0 items-center justify-center rounded-full p-0 text-ink-200 transition-colors hover:bg-transparent hover:text-foreground"
                  >
                    <X size={13} />
                  </Button>
                </InputGroup.Suffix>
              )}
            </InputGroup>
          </TextField>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-ink-200">
            <MessageSquare size={28} className="opacity-50" />
            <p className="text-center text-xs">{t('sidebar.noConversations')}</p>
          </div>
        )}

        {dms.length > 0 && (
          <div className="mb-3">
            <SectionHeader icon={AtSign} label="Mensajes directos" count={dms.length} />
            <div className="mt-0.5 flex flex-col gap-0.5">
              {dms.map((conv, i) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => handleConversationClick(conv.id)}
                  t={t}
                  animIndex={i}
                />
              ))}
            </div>
          </div>
        )}

        {rooms.length > 0 && (
          <div>
            <SectionHeader icon={Hash} label="Canales y grupos" count={rooms.length} />
            <div className="mt-0.5 flex flex-col gap-0.5">
              {rooms.map((conv, i) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => handleConversationClick(conv.id)}
                  t={t}
                  animIndex={i}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Panel */}
      <UserPanel />
    </div>
  );
}

function SectionHeader({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-1 px-1 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-200">
      <Icon size={11} />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] font-semibold">{count}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Settings sidebar (same slot as ChatSidebar but for settings)
   ───────────────────────────────────────────────────────── */
const SETTINGS_NAV = [
  { id: 'profile',    icon: User    },
  { id: 'appearance', icon: Palette },
  { id: 'language',   icon: Globe   },
  { id: 'security',   icon: Shield  },
  { id: 'presence',   icon: Wifi    },
];

function SettingsSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.split('/settings/')[1] || 'profile';

  return (
    <div className="echo-sidebar-bg flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/5 px-3 shadow-sm">
        <Tooltip delay={0}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="h-7 w-7 min-w-0"
            onPress={() => navigate('/chat')}
          >
            <ArrowLeft size={16} />
          </Button>
          <Tooltip.Content><p>{t('common.back')}</p></Tooltip.Content>
        </Tooltip>
        <h2 className="echo-display text-[17px] font-semibold">{t('settings.title')}</h2>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-200">
          {t('settings.title')}
        </p>
        {SETTINGS_NAV.map(({ id, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            onPress={() => navigate(`/settings/${id}`)}
            className={[
              'flex h-auto w-full items-center justify-start gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors',
              activeTab === id
                ? 'echo-grad-brand-soft echo-ring-soft text-foreground'
                : 'text-ink-100 hover:bg-ink-750 hover:text-foreground',
            ].join(' ')}
          >
            <Icon size={15} />
            {t(`settings.tabs.${id}`)}
          </Button>
        ))}
      </nav>

      {/* User Panel at bottom */}
      <UserPanel />
    </div>
  );
}

function Sidebar() {
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');
  return (
    <AnimatePresence mode="wait">
      {isSettings ? (
        <motion.div
          key="settings"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="h-full w-full"
        >
          <SettingsSidebar />
        </motion.div>
      ) : (
        <motion.div
          key="chat"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="h-full w-full"
        >
          <ChatSidebar />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────
   Mobile bottom nav (keeps functionality on small screens)
   ───────────────────────────────────────────────────────── */
function MobileBottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const pathname = location.pathname;
  const isChats = pathname === '/chat';
  const isContacts = pathname.startsWith('/contacts');
  const isNotifications = pathname.startsWith('/notifications');
  const isSettings = pathname.startsWith('/settings');

  const items = [
    { id: 'chats', icon: MessageSquare, label: t('sidebar.chats'), path: '/chat', active: isChats },
    { id: 'contacts', icon: Users, label: t('sidebar.contacts'), path: '/contacts', active: isContacts },
    { id: 'notifications', icon: Bell, label: t('sidebar.notifications'), path: '/notifications', active: isNotifications },
    { id: 'settings', icon: Settings, label: t('sidebar.settings'), path: '/settings', active: isSettings },
  ];

  return (
    <div className="flex items-center justify-around border-t border-black/20 bg-ink-850 px-2 py-2 lg:hidden">
      {items.map(({ id, icon: Icon, label, path, active }) => (
        <Button
          key={id}
          variant="ghost"
          onPress={() => navigate(path)}
          className={`flex h-auto flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors hover:bg-transparent ${
            active ? 'text-accent' : 'text-ink-200'
          }`}
        >
          <Icon size={20} />
          <span>{label}</span>
        </Button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Root Layout
   ───────────────────────────────────────────────────────── */
export default function ChatLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const sidebarRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isOnChatIndex = pathname === '/chat';
  const isConversationRoute = /^\/chat\/.+/.test(pathname);
  const isContentRoute = !isOnChatIndex;

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const startResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarRef.current?.offsetWidth ?? 288;

    const onMove = (ev) => {
      const newWidth = Math.max(220, Math.min(420, startWidth + ev.clientX - startX));
      if (sidebarRef.current) {
        sidebarRef.current.style.width = newWidth + 'px';
        sidebarRef.current.style.minWidth = newWidth + 'px';
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden pb-[72px] text-foreground lg:flex-row lg:gap-[var(--echo-canvas-gap)] lg:p-3 lg:pb-3">
      {/* Orbit dock — desktop: vertical floating rail */}
      <div className="hidden lg:flex lg:items-center">
        <ServerOrbitDock glowColor="rgb(124 92 255 / 0.2)" />
      </div>

      {/* Channel/Settings sidebar — floating card; Ctrl+\ toggles */}
      <CanvasPanel
        ref={sidebarRef}
        elevation={2}
        radius="lg"
        inset="md"
        className={[
          isContentRoute ? 'hidden lg:flex' : 'flex flex-1 lg:flex-none',
          'transition-[width,opacity,margin] duration-200 ease-[var(--ease-echo)]',
          sidebarOpen ? 'lg:w-72 lg:min-w-[220px] lg:opacity-100' : 'lg:w-0 lg:min-w-0 lg:overflow-hidden lg:border-0 lg:!m-0 lg:opacity-0 lg:shadow-none lg:pointer-events-none',
        ].join(' ')}
        aria-hidden={!sidebarOpen}
      >
        <Sidebar />
      </CanvasPanel>

      {/* Resize handle — hidden when sidebar collapsed */}
      <div
        className={`hidden w-1.5 shrink-0 cursor-col-resize self-stretch rounded-full bg-transparent transition-colors hover:bg-accent/45 lg:block ${sidebarOpen ? '' : 'lg:hidden'}`}
        onMouseDown={startResize}
        aria-hidden
      />

      {/* Main content — hero card, highest elevation */}
      <CanvasPanel
        as="main"
        elevation={3}
        radius="xl"
        inset="md"
        accentGlow
        className={`${isOnChatIndex ? 'hidden lg:flex' : ''} echo-chat-bg min-w-0 flex-1 flex-col`}
      >
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={CONTENT_TRANSITION}
          className="h-full min-h-0 flex-1"
        >
          <Outlet />
        </motion.div>
      </CanvasPanel>

      {/* Mobile / tablet bottom orbit dock (<1024px) */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <ServerOrbitDock orientation="bottom" />
      </div>

      {/* Mobile bottom nav — secondary routes only */}
      {isContentRoute && !isConversationRoute && <MobileBottomNav />}

      {/* Ctrl/Cmd+K quick navigation */}
      <CommandPalette />
    </div>
  );
}
