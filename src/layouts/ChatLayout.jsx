import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Input, Tooltip } from '@heroui/react';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/dates';

const SIDEBAR_TRANSITION = { duration: 0.2, ease: 'easeOut' };
const CONTENT_TRANSITION = { duration: 0.2, ease: 'easeOut' };

function AnimatedSidebar({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={SIDEBAR_TRANSITION}
      className="flex h-full w-80 flex-col border-r border-separator bg-surface"
    >
      {children}
    </motion.div>
  );
}

function ConversationItem({ conversation, isActive, onClick, t, animIndex = 0 }) {
  const isDirect = conversation.type === 'direct';
  const name = conversation.display_name || conversation.name || t('sidebar.noName');
  const lastMsg = conversation.last_message_body;
  const time = conversation.last_message_at;
  const unread = conversation.unread_count || 0;

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(animIndex, 10) * 0.025 }}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-default ${
        isActive ? 'bg-default' : ''
      }`}
    >
      <div className="relative shrink-0">
        {isDirect ? (
          <UserAvatar
            user={{ display_name: name, presence: conversation.member_presence, avatar_url: conversation.other_avatar_url }}
            showStatus
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
            <Hash size={18} className="text-accent" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>
            {name}
          </span>
          {time && (
            <span className="ml-2 shrink-0 text-xs text-muted">
              {formatMessageTime(time)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="truncate text-xs text-muted">{lastMsg || '\u00A0'}</p>
          {unread > 0 && (
            <span className="ml-2 shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

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
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-separator px-3 py-3">
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
            <ArrowLeft size={16} />
          </Button>
          <Tooltip.Content><p>{t('common.back')}</p></Tooltip.Content>
        </Tooltip>
        <h2 className="text-sm font-semibold">{t('settings.title')}</h2>
      </div>

      {/* User card */}
      <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-border bg-background-secondary px-3 py-2.5">
        <UserAvatar user={user} size="sm" showStatus />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user?.display_name}</p>
          <p className="truncate text-xs text-muted">@{user?.username}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="mx-2 mt-2 flex flex-col gap-0.5 p-1">
        {SETTINGS_NAV.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(`/settings/${id}`)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:bg-background-secondary hover:text-foreground'
            }`}
          >
            <Icon size={15} />
            {t(`settings.tabs.${id}`)}
          </button>
        ))}
      </nav>

      {/* Spacer + Logout */}
      <div className="mt-auto border-t border-separator px-3 py-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
        >
          <LogOut size={15} />
          {t('sidebar.logout')}
        </button>
      </div>
    </AnimatedSidebar>
  );
}

function ChatSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { conversations, activeConversationId, setActiveConversation } = useChatStore();
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => {
    const name = (c.display_name || c.name || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const handleConversationClick = useCallback(
    (id) => {
      setActiveConversation(id);
      navigate(`/chat/${id}`);
    },
    [setActiveConversation, navigate],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <AnimatedSidebar>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-separator px-4 py-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} showStatus size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.display_name}</p>
            <p className="truncate text-xs text-muted">@{user?.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat/new')}>
              <Plus size={18} />
            </Button>
            <Tooltip.Content>
              <p>{t('sidebar.newChat')}</p>
            </Tooltip.Content>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <div className="relative px-3 py-2">
        <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <Input
          placeholder={t('sidebar.searchConversation')}
          className="bg-default pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted">
            <MessageSquare size={32} />
            <p className="text-sm">{t('sidebar.noConversations')}</p>
          </div>
        )}
        {filtered.map((conv, i) => (
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

      {/* Bottom Nav */}
      <div className="flex items-center justify-around border-t border-separator px-2 py-2">
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
            <MessageSquare size={18} />
          </Button>
          <Tooltip.Content><p>{t('sidebar.chats')}</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/contacts')}>
            <Users size={18} />
          </Button>
          <Tooltip.Content><p>{t('sidebar.contacts')}</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/notifications')}>
            <Bell size={18} />
          </Button>
          <Tooltip.Content><p>{t('sidebar.notifications')}</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/settings')}>
            <Settings size={18} />
          </Button>
          <Tooltip.Content><p>{t('sidebar.settings')}</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="danger" onPress={handleLogout}>
            <LogOut size={18} />
          </Button>
          <Tooltip.Content><p>{t('sidebar.logout')}</p></Tooltip.Content>
        </Tooltip>
      </div>
    </AnimatedSidebar>
  );
}

function Sidebar() {
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');
  return isSettings ? <SettingsSidebar key="settings" /> : <ChatSidebar key="chat" />;
}

export default function ChatLayout() {
  const location = useLocation();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={CONTENT_TRANSITION}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
