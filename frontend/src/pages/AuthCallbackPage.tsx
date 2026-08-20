import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import AppLogo from '@/components/AppLogo';
import { useAuthStore } from '@/stores/authStore';

// Aterrizaje del SSO: el backend redirige aquí con el token en el fragmento
// (#token=...&expires_at=...). Lo tomamos, lo persistimos y entramos al chat.
// El fragmento nunca viaja al servidor ni queda en logs / Referer.
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const loginWithToken = useAuthStore((s) => s.loginWithToken);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    // Limpiamos el fragmento del historial para no dejar el token en la URL.
    window.history.replaceState(null, '', window.location.pathname);

    if (!token) {
      navigate('/login?sso_error=1', { replace: true });
      return;
    }

    loginWithToken(token)
      .then(() => navigate('/chat', { replace: true }))
      .catch(() => navigate('/login?sso_error=1', { replace: true }));
  }, [loginWithToken, navigate]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <AppLogo size="sm" withGlow />
      <Spinner size="lg" />
    </div>
  );
}
