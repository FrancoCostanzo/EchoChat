import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Spinner } from '@heroui/react';
import { BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/layouts/AuthLayout';
import { notificationsApi } from '@/lib/endpoints';

/** Link "Dejar de recibir estos emails" del pie de los correos: funciona sin sesión. */
export default function UnsubscribePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'done' | 'error'>(token ? 'loading' : 'error');
  // En desarrollo StrictMode monta dos veces: la baja va una sola vez.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    notificationsApi.unsubscribeEmail(token)
      .then(() => setState('done'))
      .catch(() => setState('error'));
  }, [token]);

  return (
    <AuthLayout subtitle={t('unsubscribe.title')}>
      <Card className="echo-glass-strong">
        <Card.Content className="flex flex-col items-center gap-4 p-6 text-center">
          {state === 'loading' ? (
            <Spinner />
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                <BellOff size={22} />
              </div>
              <p className="text-sm">{state === 'done' ? t('unsubscribe.done') : t('unsubscribe.error')}</p>
              <Link to="/settings/notifications" className="text-sm font-medium text-accent hover:underline">
                {t('unsubscribe.manage')}
              </Link>
            </>
          )}
        </Card.Content>
      </Card>
    </AuthLayout>
  );
}
