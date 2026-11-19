import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import { useChatStore } from '@/stores/chatStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { registerServiceWorker, setAppBadge, syncPushSubscription } from '@/lib/push';

/**
 * Ata la app web al service worker de las notificaciones push: registra el
 * worker, sigue los clicks de las notificaciones, atiende una llamada cuando
 * se abrió con "Atender" y mantiene el contador del ícono de la app instalada.
 *
 * No renderiza nada; en Electron todo es no-op (ver lib/push.ts).
 */
export default function PushIntegration() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const badgeEnabled = useNotificationStore((s) => s.settings?.badge_enabled ?? true);
  const totalUnread = useChatStore((s) =>
    s.conversations.reduce((total, c) => total + (c.unread_count || 0), 0),
  );

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    if (isAuthenticated) void syncPushSubscription();
  }, [isAuthenticated]);

  // El worker no puede navegar una pestaña ya abierta sin recargarla: le pide
  // a la app que lo haga con el router.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent<{ type?: string; url?: string }>) => {
      if (event.data?.type === 'echochat:navigate' && event.data.url) void navigate(event.data.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  // `?call=<id>&answer=1`: se abrió tocando "Atender". El timbre llega por
  // socket al conectar (el servidor reenvía los pendientes) y se atiende solo.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const callId = params.get('call');
    if (!callId) return;
    if (params.get('answer') === '1') useCallStore.getState().setAutoAccept(callId);
    params.delete('call');
    params.delete('answer');
    const search = params.toString();
    void navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    setAppBadge(isAuthenticated && badgeEnabled ? totalUnread : 0);
  }, [isAuthenticated, badgeEnabled, totalUnread]);

  return null;
}
