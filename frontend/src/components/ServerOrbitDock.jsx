import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Tooltip, toast } from '@heroui/react';
import {
  MessageSquare,
  Users,
  Bell,
  Settings,
  LogOut,
  Plus,
  Compass,
  Bookmark,
  Megaphone,
  Shield,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useConfirm } from '@/components/ConfirmProvider';
import CanvasPanel from '@/components/CanvasPanel';

/* ─────────────────────────────────────────────────────────
   ServerOrbitDock — floating nav dock (macOS-style). Active
   orb morphs circle → squircle with glow (no Discord pill).
   Spec: docs/SPATIAL_CANVAS.md
   ───────────────────────────────────────────────────────── */

function DockOrb({ icon: Icon, label, onClick, active, variant = 'default', badge = 0 }) {
  const isDanger = variant === 'danger';
  const isBrand = variant === 'brand';

  const orbClass = isBrand
    ? active
      ? 'echo-grad-brand echo-glow-md echo-on-accent'
      : 'bg-ink-800/90 text-accent hover:bg-accent hover:text-accent-foreground'
    : isDanger
      ? 'bg-ink-800/90 text-echo-dnd hover:bg-echo-dnd hover:text-white'
      : active
        ? 'echo-grad-brand echo-glow-md echo-on-accent'
        : 'bg-ink-800/90 text-ink-100 hover:bg-ink-600 hover:text-foreground';

  return (
    <Tooltip delay={0} placement="right">
      <Button
        variant="ghost"
        onPress={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className="group relative flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-none p-0 [--button-bg-hover:transparent] [--button-bg-pressed:transparent]"
      >
        <span
          className={[
            'flex h-11 w-11 items-center justify-center transition-all duration-200 ease-[var(--ease-spring)]',
            active ? 'rounded-[22%]' : 'rounded-full',
            orbClass,
          ].join(' ')}
        >
          <Icon size={20} strokeWidth={2.25} className="size-5 shrink-0" />
        </span>

        {badge > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-echo-dnd px-1 text-[10px] font-bold text-white ring-2 ring-ink-850">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Button>
      <Tooltip.Content>
        <p className="text-xs font-semibold">{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export default function ServerOrbitDock({
  orientation = 'vertical',
  glowColor,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const confirm = useConfirm();
  const conversations = useChatStore((s) => s.conversations);

  const canAdmin = (user?.roles || []).includes('super_admin')
    || (user?.permissions || []).some((p) => p.startsWith('admin.'));

  const pathname = location.pathname;
  const isChat = pathname === '/chat' || pathname.startsWith('/chat/');
  const isContacts = pathname.startsWith('/contacts');
  const isChannels = pathname.startsWith('/channels');
  const isBroadcasts = pathname.startsWith('/broadcasts');
  const isSaved = pathname.startsWith('/saved');
  const isNotifications = pathname.startsWith('/notifications');
  const isSettings = pathname.startsWith('/settings');
  const isAdmin = pathname.startsWith('/admin');
  const isNew = pathname === '/chat/new';

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const brandActive = isChat && !isNew;

  const handleLogout = async () => {
    const ok = await confirm({
      status: 'warning',
      title: t('logout.confirmTitle'),
      message: t('logout.confirmMessage'),
      confirmLabel: t('sidebar.logout'),
    });
    if (!ok) return;
    await logout();
    toast.success(t('logout.success'));
    navigate('/login');
  };

  const isHorizontal = orientation === 'bottom';

  const panelClass = isHorizontal
    ? 'flex max-w-[min(100vw-1rem,560px)] flex-row items-center justify-center gap-1 px-3 py-2'
    : 'flex max-h-full w-[76px] shrink-0 flex-col items-center gap-2 px-2 py-3';

  const dockGlowStyle = brandActive && glowColor && !isHorizontal
    ? { boxShadow: `0 8px 32px ${glowColor}` }
    : undefined;

  const separator = (
    <div
      className={
        isHorizontal
          ? 'mx-0.5 h-7 w-px shrink-0 bg-ink-400/40'
          : 'my-0.5 h-px w-8 shrink-0 bg-ink-400/40'
      }
      aria-hidden
    />
  );

  return (
    <CanvasPanel
      as="nav"
      glass
      radius="xl"
      clip={false}
      accentGlow={brandActive && !isHorizontal}
      aria-label="Primary"
      className={panelClass}
      style={dockGlowStyle}
    >
      <DockOrb
        icon={MessageSquare}
        label={t('sidebar.chats')}
        onClick={() => navigate('/chat')}
        active={brandActive}
        variant="brand"
        badge={totalUnread}
      />

      {separator}

      <div className={isHorizontal ? 'flex flex-row items-center gap-1' : 'flex flex-col items-center gap-2'}>
        <DockOrb
          icon={Plus}
          label={t('sidebar.newChat')}
          onClick={() => navigate('/chat/new')}
          active={isNew}
        />
        <DockOrb
          icon={Users}
          label={t('sidebar.contacts')}
          onClick={() => navigate('/contacts')}
          active={isContacts}
        />
        <DockOrb
          icon={Compass}
          label={t('sidebar.explore')}
          onClick={() => navigate('/channels')}
          active={isChannels}
        />
        <DockOrb
          icon={Megaphone}
          label={t('sidebar.broadcasts')}
          onClick={() => navigate('/broadcasts')}
          active={isBroadcasts}
        />
        <DockOrb
          icon={Bookmark}
          label={t('sidebar.saved')}
          onClick={() => navigate('/saved')}
          active={isSaved}
        />
      </div>

      {separator}

      <div className={isHorizontal ? 'flex flex-row items-center gap-1' : 'flex flex-col items-center gap-2'}>
        <DockOrb
          icon={Bell}
          label={t('sidebar.notifications')}
          onClick={() => navigate('/notifications')}
          active={isNotifications}
        />
        {canAdmin && (
          <DockOrb
            icon={Shield}
            label={t('sidebar.admin')}
            onClick={() => navigate('/admin')}
            active={isAdmin}
          />
        )}
        <DockOrb
          icon={Settings}
          label={t('sidebar.settings')}
          onClick={() => navigate('/settings')}
          active={isSettings}
        />
        <DockOrb
          icon={LogOut}
          label={t('sidebar.logout')}
          onClick={handleLogout}
          variant="danger"
        />
      </div>
    </CanvasPanel>
  );
}
