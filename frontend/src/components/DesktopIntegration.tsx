import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@heroui/react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import ScreenPicker from '@/components/ScreenPicker';
import {
  onOpenConversation,
  onSsoResult,
  onUpdateReady,
  restartToUpdate,
  setDesktopBadge,
  setDesktopTrayLabels,
  watchWindowFocus,
} from '@/lib/desktop';

/**
 * Ata la app al escritorio: bandeja, contador de no leídos, foco de la ventana
 * y click en las notificaciones nativas.
 *
 * No renderiza nada y en la web todas sus llamadas son no-op, así que se monta
 * incondicionalmente en vez de envolverlo en un `isElectron()`.
 */
export default function DesktopIntegration() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const loginWithToken = useAuthStore((s) => s.loginWithToken);

  const totalUnread = useChatStore((s) =>
    s.conversations.reduce((total, c) => total + (c.unread_count || 0), 0),
  );

  // El main no tiene i18n: las etiquetas del tray se le mandan desde acá, y se
  // vuelven a mandar cuando el usuario cambia de idioma.
  useEffect(() => {
    setDesktopTrayLabels({
      open: t('desktop.tray.open'),
      muteNotifications: t('desktop.tray.mute'),
      autoLaunch: t('desktop.tray.autoLaunch'),
      changeServer: t('desktop.tray.changeServer'),
      quit: t('desktop.tray.quit'),
      tooltip: t('desktop.tray.tooltip'),
    });
  }, [t, i18n.language]);

  useEffect(() => watchWindowFocus(), []);

  useEffect(
    () => onOpenConversation((conversationId) => navigate(`/chat/${conversationId}`)),
    [navigate],
  );

  useEffect(() => {
    setDesktopBadge(totalUnread, t('desktop.unreadBadge', { count: totalUnread }));
  }, [totalUnread, t]);

  // La actualización ya se descargó sola; sólo falta reiniciar. El aviso no
  // caduca (`timeout: 0`) pero tampoco fuerza nada: reiniciar en medio de una
  // conversación sería peor que esperar.
  useEffect(
    () => onUpdateReady((version) => {
      toast.info(t('desktop.update.ready'), {
        description: t('desktop.update.version', { version }),
        timeout: 0,
        actionProps: {
          children: t('desktop.update.restart'),
          onPress: () => restartToUpdate(),
        },
      });
    }),
    [t],
  );

  // El SSO se abrió en el navegador del sistema y el token vuelve por el deep
  // link `echochat://` (ver desktop/src/main/deepLink.ts).
  useEffect(
    () => onSsoResult((result) => {
      if (!result.token) {
        void navigate('/login?sso_error=1', { replace: true });
        return;
      }
      loginWithToken(result.token)
        .then(() => navigate('/chat', { replace: true }))
        .catch(() => navigate('/login?sso_error=1', { replace: true }));
    }),
    [loginWithToken, navigate],
  );

  return <ScreenPicker />;
}
