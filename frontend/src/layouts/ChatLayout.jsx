import { useState, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
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
  User,
  Palette,
  Globe,
  Shield,
  Wifi,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/dates';

const SIDEBAR_TRANSITION = { duration: 0.16, ease: 'easeOut' };
const CONTENT_TRANSITION = { duration: 0.16, ease: 'easeOut' };

/* ═══════════════════════════════════════════════════════════════════════
   NAV RAIL (Discord-style left-most server rail)
   ═══════════════════════════════════════════════════════════════════════ */

function RailItem({ icon: Icon, active, onClick, tooltip, tone = 'default' }) {
  const base =
    tone === 'danger'
      ? 'bg-surface text-danger hover:bg-danger hover:text-white'
      : tone === 'accent'
        ? 'bg-accent text-accent-foreground hover:bg-accent-hover'
        : active
          ? 'bg-accent text-accent-foreground'
          : 'bg-surface text-foreground hover:bg-accent hover:text-accent-foreground';

  return (
    <div className="rail-item relative flex h-12 w-full items-center justify-center" data-active={active ? 'true' : 'false'}>
      <span className="rail-pill" aria-hidden />
      <Tooltip content={tooltip} placement="right" delay={0}>
        <button
          type="button"
          onClick={onClick}
          className={`rail-btn flex h-10 w-10 items-center justify-center ${base}`}
          aria-label={tooltip}
        >
          <Icon size={20} strokeWidth={2} />
        </button>
      </Tooltip>
    </div>
  );
}

function NavRail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const pathname = location.pathname;
  const isChats = pathname === '/chat' || /^\/chat\/.+/.test(pathname);
  const isContacts = pathname.startsWith('/contacts');
  const isNotifications = pathname.startsWith('/notifications');
  const isSettings = pathname.startsWith('/settings');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="hidden w-[72px] shrink-0 flex-col items-center gap-1 bg-surface-secondary py-3 md:flex">
      <RailItem
        icon={MessageSquare}
        active={isChats}
        onClick={() => navigate('/chat')}
        tooltip={t('sidebar.chats')}
        tone={isChats ? 'accent' : 'default'}
      />

      <div className="my-1 h-0.5 w-8 rounded bg-separator" aria-hidden />

      <RailItem
        icon={Users}
        active={isContacts}
        onClick={() => navigate('/contacts')}
        tooltip={t('sidebar.contacts')}
      />
      <RailItem
        icon={Bell}
        active={isNotifications}
        onClick={() => navigate('/notifications')}
        tooltip={t('sidebar.notifications')}
      />
      <RailItem
        icon={Settings}
        active={isSettings}
        onClick={() => navigate('/settings')}
        tooltip={t('sidebar.settings')}
      />

      {/* spacer */}
      <div className="flex-1" />

      {/* User avatar + logout pinned at bottom */}
      <div className="rail-item relative flex h-12 w-full items-center justify-center" data-active="false">
        <Tooltip content={user?.display_name || ''} placement="right" delay={0}>
          <button
            type="button"
            className="rail-btn flex h-10 w-10 items-center justify-center overflow-hidden"
            onClick={() => navigate('/settings/profile')}
            aria-label={t('sidebar.settings')}
          >
            <UserAvatar user={user} size="md" showStatus />
          </button>
        </Tooltip>
      </div>
      <RailItem
        icon={LogOut}
        onClick={handleLogout}
        tooltip={t('sidebar.logout')}
        tone="danger"
      />
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CHAT SIDEBAR (channels list)
   ═══════════════════════════════════════════════════════════════════════ */

function AnimatedSidebar({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={SIDEBAR_TRANSITION}
      className="flex h-full w-full flex-col bg-surface"
    >
      {children}
    </motion.div>
  );
}

function ConversationRow({ conversation, isActive, onClick, t }) {
  const isDirect = conversation.type === 'direct';
  const name = conversation.display_name || conversation.name || t('sidebar.noName');
  const lastMsg = conversation.last_message_body;
  const time = conversation.last_message_at;
  const unread = conversation.unread_count || 0;
  const hasUnread = unread > 0;

  return (
    <button
      onClick={onClick}
      className={`group relative mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
        isActive
          ? 'bg-surface-tertiary text-foreground'
          : hasUnread
            ? 'text-foreground hover:bg-surface-tertiary/60'
            : 'text-muted hover:bg-surface-tertiary/60 hover:text-foreground'
      }`}
    >
      {/* Unread pill (Discord-style left bar) */}
      {hasUnread && !isActive && (
        <span className="absolute -left-2 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r-full bg-foreground" />
      )}

      {/* Icon */}
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
          <div className="flex h-8 w-8 items-center justify-center">
            <Hash size={20} className="text-muted" strokeWidth={2.25} />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-[14px] ${hasUnread || isActive ? 'font-semibold' : 'font-medium'}`}>
            {name}
          </span>
          {time && (
            <span className="shrink-0 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
              {formatMessageTime(time)}
            </span>
          )}
        </div>
        {lastMsg && (
          <p className="truncate text-[11px] leading-tight text-muted">{lastMsg}</p>
        )}
      </div>

      {/* Unread count */}
      {hasUnread && (
        <span className="ml-1 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function SectionHeader({ label, count, onPlus, collapsed, onToggle, plusLabel }) {
  return (
    <div className="group flex items-center gap-1 px-3 pb-1 pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:text-foreground"
      >
        {collapsed
          ? <ChevronRight size={10} strokeWidth={3} />
          : <ChevronDown size={10} strokeWidth={3} />}
        <span className="truncate">{label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="ml-0.5 opacity-60">— {count}</span>
        )}
      </button>
      {onPlus && (
        <Tooltip content={plusLabel} delay={0}>
          <button
            type="button"
            onClick={onPlus}
            className="shrink-0 rounded text-muted opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
            aria-label={plusLabel}
          >
            <Plus size={16} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function ChatSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { conversations, activeConversationId, setActiveConversation } = useChatStore();
  const [search, setSearch] = useState('');
  const [dmCollapsed, setDmCollapsed] = useState(false);
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);

  const { dms, channels } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (c) =>
      !q || (c.display_name || c.name || '').toLowerCase().includes(q);
    return {
      dms: conversations.filter((c) => c.type === 'direct' && match(c)),
      channels: conversations.filter((c) => c.type !== 'direct' && match(c)),
    };
  }, [conversations, search]);

  const handleConversationClick = useCallback(
    (id) => {
      setActiveConversation(id);
      navigate(`/chat/${id}`);
    },
    [setActiveConversation, navigate],
  );

  return (
    <AnimatedSidebar>
      {/* Search header */}
      <div className="shrink-0 border-b border-separator px-3 py-2.5 shadow-[0_1px_0_0_rgba(0,0,0,0.2)]">
        <TextField fullWidth aria-label={t('sidebar.searchConversation')}>
          <InputGroup fullWidth variant="secondary" className="h-7">
            <InputGroup.Prefix>
              <Search size={13} className="text-muted" />
            </InputGroup.Prefix>
            <InputGroup.Input
              placeholder={t('sidebar.searchConversation')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-[13px]"
            />
          </InputGroup>
        </TextField>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Quick actions */}
        <nav className="mt-2 flex flex-col gap-0.5 px-2">
          <button
            onClick={() => navigate('/contacts')}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-[14px] font-medium text-muted transition-colors hover:bg-surface-tertiary/60 hover:text-foreground md:hidden"
          >
            <Users size={18} />
            {t('sidebar.contacts')}
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-[14px] font-medium text-muted transition-colors hover:bg-surface-tertiary/60 hover:text-foreground md:hidden"
          >
            <Bell size={18} />
            {t('sidebar.notifications')}
          </button>
          <button
            onClick={() => navigate('/chat/new')}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-[14px] font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            <Plus size={18} />
            {t('sidebar.newChat')}
          </button>
        </nav>

        {/* Channels */}
        {channels.length > 0 && (
          <>
            <SectionHeader
              label={t('sidebar.channels', { defaultValue: 'Canales' })}
              count={channels.length}
              collapsed={channelsCollapsed}
              onToggle={() => setChannelsCollapsed((v) => !v)}
              onPlus={() => navigate('/chat/new')}
              plusLabel={t('sidebar.newChat')}
            />
            {!channelsCollapsed && (
              <div className="flex flex-col">
                {channels.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    onClick={() => handleConversationClick(conv.id)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Direct Messages */}
        <SectionHeader
          label={t('sidebar.directMessages', { defaultValue: 'Mensajes directos' })}
          count={dms.length}
          collapsed={dmCollapsed}
          onToggle={() => setDmCollapsed((v) => !v)}
          onPlus={() => navigate('/chat/new')}
          plusLabel={t('sidebar.newChat')}
        />
        {!dmCollapsed && (
          <div className="flex flex-col">
            {dms.length === 0 && (
              <div className="flex flex-col items-center gap-1 py-6 text-muted">
                <MessageSquare size={24} strokeWidth={1.5} />
                <p className="text-xs">{t('sidebar.noConversations')}</p>
              </div>
            )}
            {dms.map((conv) => (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onClick={() => handleConversationClick(conv.id)}
                t={t}
              />
            ))}
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* User footer panel (Discord-style) */}
      <div className="shrink-0 border-t border-separator bg-surface-secondary px-2 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/settings/profile')}
            className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-surface-tertiary/60"
          >
            <UserAvatar user={user} size="sm" showStatus />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{user?.display_name}</p>
              <p className="truncate text-[11px] leading-tight text-muted">@{user?.username}</p>
            </div>
          </button>
          <Tooltip content={t('sidebar.settings')} delay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="shrink-0 rounded-md text-muted hover:text-foreground"
              onPress={() => navigate('/settings')}
            >
              <Settings size={18} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </AnimatedSidebar>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SETTINGS SIDEBAR
   ═══════════════════════════════════════════════════════════════════════ */

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
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const activeTab = location.pathname.split('/settings/')[1] || 'profile';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <AnimatedSidebar>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-separator px-3 shadow-[0_1px_0_0_rgba(0,0,0,0.2)]">
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
            <ArrowLeft size={16} />
          </Button>
          <Tooltip.Content><p>{t('common.back')}</p></Tooltip.Content>
        </Tooltip>
        <h2 className="text-[15px] font-semibold">{t('settings.title')}</h2>
      </div>

      <div className="mx-3 mt-3 flex items-center gap-3 rounded-md bg-surface-secondary px-3 py-2">
        <UserAvatar user={user} size="sm" showStatus />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user?.display_name}</p>
          <p className="truncate text-xs text-muted">@{user?.username}</p>
        </div>
      </div>

      <nav className="mt-2 flex flex-col gap-0.5 px-2">
        {SETTINGS_NAV.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(`/settings/${id}`)}
            className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-[14px] font-medium transition-colors ${
              activeTab === id
                ? 'bg-surface-tertiary text-foreground'
                : 'text-muted hover:bg-surface-tertiary/60 hover:text-foreground'
            }`}
          >
            <Icon size={16} />
            {t(`settings.tabs.${id}`)}
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-separator px-2 py-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-[14px] font-medium text-danger transition-colors hover:bg-danger/15"
        >
          <LogOut size={16} />
          {t('sidebar.logout')}
        </button>
      </div>
    </AnimatedSidebar>
  );
}

function Sidebar() {
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');
  return isSettings ? <SettingsSidebar key="settings" /> : <ChatSidebar key="chat" />;
}

/* ═══════════════════════════════════════════════════════════════════════
   MOBILE BOTTOM NAV
   ═══════════════════════════════════════════════════════════════════════ */

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
    <div className="flex shrink-0 items-center justify-around border-t border-separator bg-surface-secondary px-2 py-1.5 md:hidden">
      {items.map(({ id, icon: Icon, label, path, active }) => (
        <button
          key={id}
          onClick={() => navigate(path)}
          className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] transition-colors ${
            active ? 'text-accent' : 'text-muted'
          }`}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════════════════════════════ */

export default function ChatLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const sidebarRef = useRef(null);

  const isOnChatIndex = pathname === '/chat';
  const isConversationRoute = /^\/chat\/.+/.test(pathname);
  const isContentRoute = !isOnChatIndex;

  const startResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarRef.current?.offsetWidth ?? 240;

    const onMove = (ev) => {
      const newWidth = Math.max(200, Math.min(420, startWidth + ev.clientX - startX));
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
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      {/* Desktop nav rail */}
      <NavRail />

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden md:flex-row">
        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={`${isContentRoute ? 'hidden md:flex' : 'flex flex-1 md:flex-none'} md:w-64`}
        >
          <Sidebar />
        </div>

        {/* Resize handle */}
        <div
          className="hidden md:flex w-0.5 shrink-0 cursor-col-resize items-stretch bg-transparent transition-colors hover:bg-accent/40"
          onMouseDown={startResize}
        />

        {/* Main content (wrapped in rounded container, Discord-style) */}
        <main
          className={`${
            isOnChatIndex ? 'hidden md:block' : ''
          } relative flex-1 min-w-0 overflow-hidden bg-background md:my-0 md:rounded-none`}
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={CONTENT_TRANSITION}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </main>

        {/* Mobile bottom nav */}
        {isContentRoute && !isConversationRoute && <MobileBottomNav />}
      </div>
    </div>
  );
}
