import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { Bell, BellOff, Check, CheckCheck, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationsApi } from '@/lib/endpoints';
import { formatRelative } from '@/lib/dates';

function NotificationItem({ notification, onRead }) {
  return (
    <Button
      variant="ghost"
      onPress={() => !notification.read_at && onRead(notification.id)}
      className={`flex h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-lg px-4 py-3 text-left transition-colors hover:bg-default ${
        !notification.read_at ? 'bg-accent-soft' : ''
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <Bell size={16} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${!notification.read_at ? 'font-semibold' : ''}`}>
          {notification.title || notification.event_type}
        </p>
        {notification.body && (
          <p className="mt-0.5 text-xs text-muted">{notification.body}</p>
        )}
        <p className="mt-1 text-xs text-muted">{formatRelative(notification.created_at)}</p>
      </div>
      {!notification.read_at && (
        <div className="h-2 w-2 shrink-0 rounded-full bg-accent mt-2" />
      )}
    </Button>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.list({ limit: 50 });
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    await notificationsApi.read(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  };

  const markAllRead = async () => {
    await notificationsApi.readAll();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-black/20 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button isIconOnly size="sm" variant="ghost" className="md:hidden shrink-0" onPress={() => navigate('/chat')}>
            <ArrowLeft size={18} />
          </Button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Bell size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">{t('notifications.title')}</h2>
            {unreadCount > 0 && (
              <p className="truncate text-xs text-muted">{t('notifications.unread', { count: unreadCount })}</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="secondary" onPress={markAllRead} className="shrink-0">
            <CheckCheck size={14} />
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-1 px-4 pt-3" role="status" aria-label={t('common.loading')}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ opacity: 1 - i * 0.15 }}>
                <div className="echo-shimmer h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
                  <div className="echo-shimmer h-3 w-1/2 rounded-full" />
                  <div className="echo-shimmer h-2.5 w-3/4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted">
            <BellOff size={40} />
            <p className="text-sm">{t('notifications.empty')}</p>
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
          ))
        )}
      </div>
    </div>
  );
}
