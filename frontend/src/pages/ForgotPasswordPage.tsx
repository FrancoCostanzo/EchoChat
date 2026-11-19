import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, InputGroup, Label, Spinner, TextField } from '@heroui/react';
import { AlertCircle, MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/layouts/AuthLayout';
import { authApi } from '@/lib/endpoints';

/**
 * "Olvidé mi contraseña": pide usuario o email y manda el link. La respuesta es
 * siempre la misma, exista o no la cuenta, así que la pantalla también.
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    authApi.passwordResetStatus()
      .then(({ data }) => { if (alive) setAvailable(data.available); })
      .catch(() => { if (alive) setAvailable(false); });
    return () => { alive = false; };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    setError('');
    try {
      await authApi.requestPasswordReset(identifier.trim());
      setSent(true);
    } catch (err) {
      setError((err instanceof Error && err.message) || t('auth.forgot.error'));
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <p className="mt-6 text-center text-sm text-muted">
      <Link to="/login" className="font-medium text-accent hover:underline">{t('auth.forgot.backToLogin')}</Link>
    </p>
  );

  return (
    <AuthLayout subtitle={t('auth.forgot.title')} footer={footer}>
      <Card className="echo-glass-strong">
        <Card.Content className="p-6">
          {available === null ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : !available ? (
            <p className="text-sm text-muted">{t('auth.forgot.unavailable')}</p>
          ) : sent ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                <MailCheck size={22} />
              </div>
              <p className="text-sm">{t('auth.forgot.sent')}</p>
              <p className="text-xs text-muted">{t('auth.forgot.sentHint')}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <p className="text-sm text-muted">{t('auth.forgot.desc')}</p>
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}
              <TextField fullWidth isRequired>
                <Label>{t('auth.forgot.identifier')}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={t('auth.forgot.identifierPlaceholder')}
                    autoComplete="username"
                    autoFocus
                  />
                </InputGroup>
              </TextField>
              <Button type="submit" isPending={loading} isDisabled={!identifier.trim()} className="w-full">
                {t('auth.forgot.submit')}
              </Button>
            </form>
          )}
        </Card.Content>
      </Card>
    </AuthLayout>
  );
}
