import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Card, InputGroup, TextField, Label, FieldError, Button, Spinner, InputOTP, REGEXP_ONLY_DIGITS } from '@heroui/react';
import { Eye, EyeOff, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import AuthLayout from '@/layouts/AuthLayout';
import { EASE_OUT } from '@/lib/motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/endpoints';

/** Sin model.ts propio en el backend (ver la nota en types/broadcast.ts) — inferido de oidcService.listProviders(). */
interface SsoProvider {
  name: string;
  label: string;
}

function ServerErrorAlert({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger"
    >
      <AlertCircle size={16} className="shrink-0" />
      {message}
    </motion.div>
  );
}

// ── TOTP step ────────────────────────────────────────────────────────────────
function TotpStep({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const verify2fa = useAuthStore((s) => s.verify2fa);

  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const doVerify = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);
    try {
      await verify2fa(trimmed);
      navigate('/chat');
    } catch (err) {
      setError((err instanceof Error && err.message) || t('auth.errors.invalidCode'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await doVerify(code);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col items-center gap-2 pb-1 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft">
          <ShieldCheck className="h-6 w-6 text-accent" />
        </div>
        <p className="text-sm text-muted">{t('auth.totpPrompt')}</p>
      </div>

      <AnimatePresence initial={false}>
        {error && <ServerErrorAlert message={error} />}
      </AnimatePresence>

      <div className="flex flex-col gap-2">
        <Label>{useBackup ? t('auth.backupCode') : t('auth.totpCode')}</Label>
        {useBackup ? (
          <InputGroup fullWidth variant="secondary">
            <InputGroup.Input
              placeholder="XXXXX-XXXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              autoFocus
              maxLength={11}
              inputMode="text"
            />
          </InputGroup>
        ) : (
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            onComplete={doVerify}
            isInvalid={!!error}
            autoFocus
            variant="secondary"
          >
            <InputOTP.Group>
              <InputOTP.Slot index={0} />
              <InputOTP.Slot index={1} />
              <InputOTP.Slot index={2} />
            </InputOTP.Group>
            <InputOTP.Separator />
            <InputOTP.Group>
              <InputOTP.Slot index={3} />
              <InputOTP.Slot index={4} />
              <InputOTP.Slot index={5} />
            </InputOTP.Group>
          </InputOTP>
        )}
      </div>

      <Button
        variant="ghost"
        className="h-auto w-fit min-w-0 justify-start self-start bg-transparent p-0 text-left text-xs font-normal text-accent hover:bg-transparent hover:underline"
        onPress={() => { setUseBackup((v) => !v); setCode(''); setError(''); }}
      >
        {useBackup ? t('auth.useTotpCode') : t('auth.useBackupCode')}
      </Button>

      <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.1 }}>
        <Button type="submit" isPending={loading} className="w-full">
          {({ isPending }) =>
            isPending ? (
              <><Spinner size="sm" /><span>{t('auth.verifying')}</span></>
            ) : (
              t('auth.verify')
            )
          }
        </Button>
      </motion.div>

      <Button
        variant="ghost"
        className="flex h-auto items-center gap-1.5 self-center bg-transparent p-0 text-sm font-normal text-muted hover:bg-transparent hover:text-foreground"
        onPress={onCancel}
      >
        <ArrowLeft size={14} />
        {t('auth.backToLogin')}
      </Button>
    </form>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const login = useAuthStore((s) => s.login);
  const cancelPending2fa = useAuthStore((s) => s.cancelPending2fa);

  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [form, setForm] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState<{ username?: boolean; password?: boolean }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(
    searchParams.get('sso_error') ? t('auth.errors.ssoFailed', 'No se pudo iniciar sesión con el proveedor externo.') : ''
  );
  const [loading, setLoading] = useState(false);
  const [registrationAllowed, setRegistrationAllowed] = useState(true);
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);

  useEffect(() => {
    let alive = true;
    authApi.getRegistrationStatus()
      .then((res) => { if (alive) setRegistrationAllowed(res.data?.allow_registration !== false); })
      .catch(() => {});
    authApi.ssoProviders()
      .then((res) => { if (alive) setSsoProviders((res.data?.providers as SsoProvider[]) || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const validate = (values: { username: string; password: string }) => {
    const errors: { username?: string; password?: string } = {};
    if (!values.username.trim()) errors.username = t('auth.errors.usernameRequired');
    if (!values.password) errors.password = t('auth.errors.passwordRequired');
    return errors;
  };

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;

  const touch = (field: 'username' | 'password') => setTouched((prev) => ({ ...prev, [field]: true }));
  const touchAll = () => setTouched({ username: true, password: true });

  const updateField = (field: 'username' | 'password') => (e: { target: { value: string } }) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    touchAll();
    if (!isValid) return;
    setServerError('');
    setLoading(true);
    try {
      const result = await login(form);
      if ('requires2fa' in result && result.requires2fa) {
        setStep('totp');
      } else {
        navigate('/chat');
      }
    } catch (err) {
      setServerError((err instanceof Error && err.message) || t('auth.errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel2fa = () => {
    cancelPending2fa();
    setStep('credentials');
  };

  const stepMotion = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: step === 'totp' ? 28 : -28 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: step === 'totp' ? -28 : 28 },
      };

  return (
    <AuthLayout
      subtitle={step === 'totp' ? t('auth.twoFactorTitle') : t('auth.loginTitle')}
      footer={
        step === 'credentials' && registrationAllowed ? (
          <p className="mt-6 text-center text-sm text-muted">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-medium text-accent hover:underline">
              {t('auth.registerFree')}
            </Link>
          </p>
        ) : null
      }
    >
      <Card className="echo-glass-strong overflow-hidden">
        <Card.Content className="p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...stepMotion} transition={{ duration: 0.22, ease: EASE_OUT }}>
              {step === 'totp' ? (
                <TotpStep onCancel={handleCancel2fa} />
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                  {/* Server error */}
                  <AnimatePresence initial={false}>
                    {serverError && <ServerErrorAlert message={serverError} />}
                  </AnimatePresence>

                  {/* Username */}
                  <TextField fullWidth isInvalid={touched.username && !!errors.username}>
                    <Label>{t('auth.username')}</Label>
                    <InputGroup fullWidth variant="secondary">
                      <InputGroup.Input
                        placeholder={t('auth.usernamePlaceholder')}
                        value={form.username}
                        onChange={updateField('username')}
                        onBlur={() => touch('username')}
                        autoFocus
                        autoComplete="username"
                      />
                    </InputGroup>
                    {touched.username && <FieldError>{errors.username}</FieldError>}
                  </TextField>

                  {/* Password */}
                  <TextField fullWidth isInvalid={touched.password && !!errors.password}>
                    <Label>{t('auth.password')}</Label>
                    <InputGroup fullWidth variant="secondary">
                      <InputGroup.Input
                        placeholder={t('auth.passwordPlaceholder')}
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={updateField('password')}
                        onBlur={() => touch('password')}
                        autoComplete="current-password"
                      />
                      <InputGroup.Suffix className="pr-0">
                        <Button
                          isIconOnly
                          type="button"
                          size="sm"
                          variant="ghost"
                          onPress={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                    {touched.password && <FieldError>{errors.password}</FieldError>}
                  </TextField>

                  <motion.div whileTap={{ scale: 0.97 }} transition={{ duration: 0.1 }} className="mt-1">
                    <Button type="submit" isPending={loading} className="w-full">
                      {({ isPending }) =>
                        isPending ? (
                          <><Spinner size="sm" /><span>{t('auth.loggingIn')}</span></>
                        ) : (
                          t('auth.login')
                        )
                      }
                    </Button>
                  </motion.div>

                  {/* SSO: sólo se muestra si hay proveedores OIDC configurados en el backend */}
                  {ssoProviders.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="text-xs text-muted">{t('auth.orContinueWith', 'o continuá con')}</span>
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                      {ssoProviders.map((p) => (
                        <Button
                          key={p.name}
                          type="button"
                          variant="secondary"
                          className="w-full"
                          onPress={() => { window.location.href = authApi.ssoLoginUrl(p.name); }}
                        >
                          {t('auth.continueWithProvider', { defaultValue: 'Continuar con {{provider}}', provider: p.label })}
                        </Button>
                      ))}
                    </div>
                  )}
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </Card.Content>
      </Card>
    </AuthLayout>
  );
}
