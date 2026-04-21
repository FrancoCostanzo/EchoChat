import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from '@heroui/react';
import {
  MessageSquare,
  Users,
  Bell,
  Settings,
  LogOut,
  Plus,
  Compass,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';

function RailItem({ icon: Icon, label, onClick, active, variant = 'default', badge = 0 }) {
  const isDanger = variant === 'danger';
  const isBrand = variant === 'brand';

  return (
    <Tooltip delay={0} placement="right">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="group relative flex h-12 w-12 items-center justify-center"
      >
        {/* Pill indicator (Discord-style) */}
        <span
          className={`echo-pill ${active ? 'echo-pill-active' : 'group-hover:echo-pill-hover'}`}
        />

        {/* Icon square */}
        <span
          className={[
            'flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-200',
            'group-hover:rounded-2xl',
            active ? 'rounded-2xl' : 'rounded-full',
            isBrand
              ? active
                ? 'bg-blurple-500 text-white'
                : 'bg-ink-800 text-blurple-400 group-hover:bg-blurple-500 group-hover:text-white'
              : isDanger
                ? 'bg-ink-800 text-echo-dnd group-hover:bg-echo-dnd group-hover:text-white'
                : active
                  ? 'bg-ink-600 text-foreground'
                  : 'bg-ink-800 text-ink-100 group-hover:bg-ink-600 group-hover:text-foreground',
          ].join(' ')}
        >
          <Icon size={20} strokeWidth={2.25} />
        </span>

        {/* Unread badge */}
        {badge > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -bottom-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-echo-dnd px-1.5 text-[10px] font-bold text-white ring-2 ring-ink-950">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
      <Tooltip.Content>
        <p className="text-xs font-semibold">{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export default function GuildRail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const conversations = useChatStore((s) => s.conversations);

  const pathname = location.pathname;
  const isChat = pathname === '/chat' || pathname.startsWith('/chat/');
  const isContacts = pathname.startsWith('/contacts');
  const isNotifications = pathname.startsWith('/notifications');
  const isSettings = pathname.startsWith('/settings');
  const isNew = pathname === '/chat/new';

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav
      aria-label="Primary"
      className="relative flex h-full w-[72px] shrink-0 flex-col items-center bg-ink-950 py-3 dark:bg-ink-950"
    >
      {/* Top: Home / DMs */}
      <RailItem
        icon={MessageSquare}
        label={t('sidebar.chats')}
        onClick={() => navigate('/chat')}
        active={isChat && !isNew}
        variant="brand"
        badge={totalUnread}
      />

      {/* Separator */}
      <div className="my-2 h-[2px] w-8 rounded-full bg-ink-800" />

      {/* Primary nav */}
      <div className="flex flex-col items-center gap-2">
        <RailItem
          icon={Plus}
          label={t('sidebar.newChat')}
          onClick={() => navigate('/chat/new')}
          active={isNew}
        />
        <RailItem
          icon={Users}
          label={t('sidebar.contacts')}
          onClick={() => navigate('/contacts')}
          active={isContacts}
        />
        <RailItem
          icon={Compass}
          label="Explorar"
          onClick={() => navigate('/contacts')}
          active={false}
        />
      </div>

      {/* Bottom cluster */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <RailItem
          icon={Bell}
          label={t('sidebar.notifications')}
          onClick={() => navigate('/notifications')}
          active={isNotifications}
        />
        <RailItem
          icon={Settings}
          label={t('sidebar.settings')}
          onClick={() => navigate('/settings')}
          active={isSettings}
        />
        <RailItem
          icon={LogOut}
          label={t('sidebar.logout')}
          onClick={handleLogout}
          variant="danger"
        />
      </div>
    </nav>
  );
}
