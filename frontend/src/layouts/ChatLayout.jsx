import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, InputGroup, TextField, Tooltip } from '@heroui/react';
import {
  MessageSquare,
  Bell,
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
  X,
  Users,
  Settings,
  ScrollText,
  HardDrive,
  Activity,
  Phone,
  PhoneMissed,
  Video,
  Sticker,
  Clapperboard,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';
import ServerOrbitDock from '@/components/ServerOrbitDock';
import CommandPalette from '@/components/CommandPalette';
import CanvasPanel from '@/components/CanvasPanel';
import CallOverlay from '@/components/CallOverlay';
import { formatMessageTime } from '@/lib/dates';

const CONTENT_TRANSITION = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

/* One key per *screen*, not per URL: switching between conversations keeps
   ConversationPage mounted (it crossfades internally), so the whole page
   doesn't remount and re-animate on every chat change. */
function contentKeyFor(pathname) {
  if (pathname === '/chat' || pathname === '/chat/new') return pathname;
  if (pathname.startsWith('/chat/')) return '/chat/:conversation';
  return pathname;
}

/* Three bouncing dots used in the sidebar typing indicator. */
function SidebarTypingDots() {
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-accent">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          animate={{ y: [0, -2, 0], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 1.2,
            ease: 'easeInOut',
            repeat: Number.POSITIVE_INFINITY,
            delay: index * 0.15,
          }}
          className="inline-block h-1 w-1 rounded-full bg-current"
        />
      ))}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
   ConversationItem — row in the channel/DM list
   ───────────────────────────────────────────────────────── */
function ConversationItem({ conversation, isActive, onClick, t, animIndex = 0, typingNames = [] }) {
  const isDirect = conversation.type === 'direct';
  const name = conversation.display_name || conversation.name || t('sidebar.noName');
  // Call events have no text body — show a localized preview with a lucide icon.
  const callMeta =
    conversation.last_message_type === 'system' &&
    conversation.last_message_metadata?.event === 'call'
      ? conversation.last_message_metadata
      : null;
  const callLabel = callMeta
    ? callMeta.outcome === 'missed'
      ? t('call.timeline.missed')
      : callMeta.outcome === 'declined'
        ? t('call.timeline.declined')
        : callMeta.call_type === 'video'
          ? t('call.timeline.videoCall')
          : t('call.timeline.voiceCall')
    : null;
  const CallIcon = callMeta
    ? callMeta.outcome === 'missed' || callMeta.outcome === 'declined'
      ? PhoneMissed
      : callMeta.call_type === 'video'
        ? Video
        : Phone
    : null;
  // Stickers/GIFs have no text body — show an icon + label preview.
  const stickerKind =
    conversation.last_message_type === 'sticker'
      ? conversation.last_message_metadata?.sticker?.kind || 'sticker'
      : null;
  const lastMsg = conversation.last_message_body;
  const time = conversation.last_message_at;
  const unread = conversation.unread_count || 0;
  const hasUnread = unread > 0;

  // "Escribiendo…" tiene prioridad sobre el preview del último mensaje. En DMs ya
  // se sabe quién es; en grupos mostramos el nombre (o "varios" si son varios).
  let typingText = null;
  if (typingNames.length > 0) {
    if (isDirect) typingText = t('sidebar.typing');
    else if (typingNames.length === 1) typingText = t('sidebar.someoneTyping', { name: typingNames[0] });
    else typingText = t('sidebar.severalTyping');
  }

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
      {/* Active / unread bar indicator — the active bar glides between rows */}
      {isActive ? (
        <motion.span
          layoutId="sidebar-active-bar"
          transition={{ type: 'spring', stiffness: 480, damping: 36 }}
          className="absolute -left-2 top-1/2 -mt-3 h-6 w-1 rounded-r-full bg-accent"
        />
      ) : hasUnread ? (
        <span className="absolute -left-2 top-1/2 -mt-1 h-2 w-1 rounded-r-full bg-accent" />
      ) : null}

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
        ) : conversation.type === 'group' ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-ink-100 group-hover:bg-ink-600">
            <Users size={15} strokeWidth={2.5} />
          </div>
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
        {typingText ? (
          <p className="flex items-center gap-1.5 text-xs text-accent">
            <SidebarTypingDots />
            <span className="truncate">{typingText}</span>
          </p>
        ) : callMeta ? (
          <p
            className={`flex items-center gap-1.5 text-xs ${
              callMeta.outcome === 'missed' || callMeta.outcome === 'declined'
                ? 'text-echo-dnd'
                : 'text-ink-200'
            }`}
          >
            <CallIcon size={12} className="shrink-0" />
            <span className="truncate">{callLabel}</span>
          </p>
        ) : stickerKind ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-200">
            {stickerKind === 'gif'
              ? <Clapperboard size={12} className="shrink-0" />
              : <Sticker size={12} className="shrink-0" />}
            <span className="truncate">{t(stickerKind === 'gif' ? 'sticker.previewGif' : 'sticker.previewSticker')}</span>
          </p>
        ) : (
          lastMsg && <p className="truncate text-xs text-ink-200">{lastMsg}</p>
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
  const { conversations, activeConversationId, typingUsers } = useChatStore();
  const selfId = useAuthStore((s) => s.user?.id);
  const [search, setSearch] = useState('');

  // Nombres de quienes están escribiendo en cada conversación (excluyéndome).
  const typingNamesFor = useCallback(
    (conversationId) =>
      Object.entries(typingUsers[conversationId] || {})
        .filter(([uid]) => uid !== selfId)
        .map(([, displayName]) => displayName),
    [typingUsers, selfId],
  );

  const query = search.trim().toLowerCase();
  const filtered = conversations.filter((c) => {
    if (!query) return true;
    const name = (c.display_name || c.name || '').toLowerCase();
    const lastMsg = (c.last_message_body || '').toLowerCase();
    return name.includes(query) || lastMsg.includes(query);
  });

  const dms      = filtered.filter((c) => c.type === 'direct');
  const groups   = filtered.filter((c) => c.type === 'group');
  const channels = filtered.filter((c) => c.type === 'channel');

  // Navigate only — ConversationPage owns setActiveConversation via the URL.
  // Setting the store here too made the cached timeline render (and scroll)
  // inside the outgoing chat's container, and the router transition then
  // remounted the container at scrollTop 0.
  const handleConversationClick = useCallback(
    (id) => {
      navigate(`/chat/${id}`);
    },
    [navigate],
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
            <SectionHeader icon={AtSign} label={t('sidebar.directMessages')} count={dms.length} />
            <div className="mt-0.5 flex flex-col gap-0.5">
              {dms.map((conv, i) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => handleConversationClick(conv.id)}
                  t={t}
                  animIndex={i}
                  typingNames={typingNamesFor(conv.id)}
                />
              ))}
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div className="mb-3">
            <SectionHeader icon={Users} label={t('sidebar.groups')} count={groups.length} />
            <div className="mt-0.5 flex flex-col gap-0.5">
              {groups.map((conv, i) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => handleConversationClick(conv.id)}
                  t={t}
                  animIndex={i}
                  typingNames={typingNamesFor(conv.id)}
                />
              ))}
            </div>
          </div>
        )}

        {channels.length > 0 && (
          <div>
            <SectionHeader icon={Hash} label={t('sidebar.channels')} count={channels.length} />
            <div className="mt-0.5 flex flex-col gap-0.5">
              {channels.map((conv, i) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => handleConversationClick(conv.id)}
                  t={t}
                  animIndex={i}
                  typingNames={typingNamesFor(conv.id)}
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
  { id: 'notifications', icon: Bell },
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

/* ─────────────────────────────────────────────────────────
   Admin sidebar (same slot as ChatSidebar but for /admin)
   ───────────────────────────────────────────────────────── */
const ADMIN_NAV = [
  { id: 'users',      icon: Users,       perm: 'admin.users' },
  { id: 'settings',  icon: Settings,    perm: 'admin.settings' },
  { id: 'audit',     icon: ScrollText,  perm: 'admin.view_audit' },
  { id: 'storage',   icon: HardDrive,   perm: 'admin.storage' },
  { id: 'monitoring',icon: Activity,    perm: null },
];

function AdminSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const roles = user?.roles || [];
  const perms = user?.permissions || [];
  const isSuper = roles.includes('super_admin');

  const visibleNav = ADMIN_NAV.filter(({ perm }) => {
    if (isSuper) return true;
    if (!perm) return perms.some((p) => p.startsWith('admin.'));
    return perms.includes(perm);
  });

  const activeSection = location.pathname.split('/admin/')[1] || '';

  return (
    <div className="echo-sidebar-bg flex h-full w-full flex-col">
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
        <Shield size={15} className="text-accent" />
        <h2 className="echo-display text-[17px] font-semibold">{t('admin.title')}</h2>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-200">
          {t('admin.sections.label', 'Secciones')}
        </p>
        {visibleNav.map(({ id, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            onPress={() => navigate(`/admin/${id}`)}
            className={[
              'flex h-auto w-full items-center justify-start gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors',
              activeSection === id
                ? 'echo-grad-brand-soft echo-ring-soft text-foreground'
                : 'text-ink-100 hover:bg-ink-750 hover:text-foreground',
            ].join(' ')}
          >
            <Icon size={15} />
            {t(`admin.sections.${id}`)}
          </Button>
        ))}
      </nav>

      <UserPanel />
    </div>
  );
}

function Sidebar() {
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');
  const isAdmin = location.pathname.startsWith('/admin');

  const key = isSettings ? 'settings' : isAdmin ? 'admin' : 'chat';
  const SidebarComp = isSettings ? SettingsSidebar : isAdmin ? AdminSidebar : ChatSidebar;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="h-full w-full"
      >
        <SidebarComp />
      </motion.div>
    </AnimatePresence>
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
    <div className="flex h-screen flex-col overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-foreground lg:flex-row lg:gap-[var(--echo-canvas-gap)] lg:p-3 lg:pb-3">
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
          key={contentKeyFor(pathname)}
          initial={{ opacity: 0, y: 10, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
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

      {/* Ctrl/Cmd+K quick navigation */}
      <CommandPalette />

      {/* Llamadas de voz/vídeo (entrantes y activas) */}
      <CallOverlay />
    </div>
  );
}
