import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, FieldError, InputGroup, Label, Spinner, TextField } from '@heroui/react';
import { AlertCircle, Check, Eye, EyeOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/layouts/AuthLayout';
import PasswordStrength, { PASSWORD_RULES } from '@/components/PasswordStrength';
import { authApi } from '@/lib/endpoints';

/**
 * Elegir contraseña desde un link de email: recuperación ("restablecer") o
 * invitación de una cuenta creada por el admin ("activar"). El link vale una
 * sola vez; si venció, se ofrece pedir otro.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [info, setInfo] = useState<{ purpose: 'reset' | 'invite'; username: string } | null>(null);
  const [invalid, setInvalid] = useState(!token);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    authApi.inspectPasswordToken(token)
      .then(({ data }) => { if (alive) setInfo(data); })
      .catch(() => { if (alive) setInvalid(true); });
    return () => { alive = false; };
  }, [token]);

  const strong = PASSWORD_RULES.every((r) => r.test(password));
  const matches = password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!strong || !matches) return;
    setLoading(true);
    setError('');
    try {
      await authApi.completePasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError((err instanceof Error && err.message) || t('auth.reset.error'));
    } finally {
      setLoading(false);
    }
  };

  const isInvite = info?.purpose === 'invite';
  const title = isInvite ? t('auth.reset.inviteTitle') : t('auth.reset.title');

  return (
    <AuthLayout subtitle={title}>
      <Card className="echo-glass-strong">
        <Card.Content className="p-6">
          {invalid ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted">{t('auth.reset.invalid')}</p>
              <Link to="/forgot-password" className="text-sm font-medium text-accent hover:underline">
                {t('auth.reset.requestAnother')}
              </Link>
            </div>
          ) : !info ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : done ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <Check size={22} />
              </div>
              <p className="text-sm">{isInvite ? t('auth.reset.inviteDone') : t('auth.reset.done')}</p>
              <Button className="w-full" onPress={() => navigate('/login')}>{t('auth.goLogin')}</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <p className="text-sm text-muted">
                {isInvite
                  ? t('auth.reset.inviteDesc', { username: info.username })
                  : t('auth.reset.desc', { username: info.username })}
              </p>
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}
              {/* Para que el gestor de contraseñas asocie la clave nueva al usuario. */}
              <input type="text" name="username" autoComplete="username" value={info.username} readOnly hidden />
              <TextField fullWidth isRequired>
                <Label>{t('auth.reset.newPassword')}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <InputGroup.Suffix className="pr-0">
                    <Button
                      isIconOnly
                      type="button"
                      size="sm"
                      variant="ghost"
                      onPress={() => setShow((v) => !v)}
                      aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </InputGroup.Suffix>
                </InputGroup>
                {password && <PasswordStrength password={password} />}
              </TextField>
              <TextField fullWidth isRequired isInvalid={Boolean(confirm) && !matches}>
                <Label>{t('auth.confirmPassword')}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                  {confirm && (
                    <InputGroup.Suffix>
                      <span className={matches ? 'text-success' : 'text-danger'}>
                        {matches ? <Check size={16} /> : <X size={16} />}
                      </span>
                    </InputGroup.Suffix>
                  )}
                </InputGroup>
                {confirm && !matches && <FieldError>{t('auth.errors.passwordMismatch')}</FieldError>}
              </TextField>
              <Button type="submit" isPending={loading} isDisabled={!strong || !matches} className="w-full">
                {isInvite ? t('auth.reset.inviteSubmit') : t('auth.reset.submit')}
              </Button>
            </form>
          )}
        </Card.Content>
      </Card>
    </AuthLayout>
  );
}
