import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, InputGroup, TextField, Label, FieldError, Button, Spinner, InputOTP, REGEXP_ONLY_DIGITS } from '@heroui/react';
import { MessageCircle, Eye, EyeOff, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';

// ── TOTP step ────────────────────────────────────────────────────────────────
function TotpStep({ onCancel }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const verify2fa = useAuthStore((s) => s.verify2fa);

  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const doVerify = async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);
    try {
      await verify2fa(trimmed);
      navigate('/chat');
    } catch (err) {
      setError(err.message || t('auth.errors.invalidCode'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
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

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

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

      <button
        type="button"
        className="text-left text-xs text-accent hover:underline"
        onClick={() => { setUseBackup((v) => !v); setCode(''); setError(''); }}
      >
        {useBackup ? t('auth.useTotpCode') : t('auth.useBackupCode')}
      </button>

      <Button type="submit" isPending={loading} className="w-full">
        {({ isPending }) =>
          isPending ? (
            <><Spinner size="sm" /><span>{t('auth.verifying')}</span></>
          ) : (
            t('auth.verify')
          )
        }
      </Button>

      <button
        type="button"
        className="flex items-center gap-1.5 self-center text-sm text-muted hover:text-foreground"
        onClick={onCancel}
      >
        <ArrowLeft size={14} />
        {t('auth.backToLogin')}
      </button>
    </form>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const cancelPending2fa = useAuthStore((s) => s.cancelPending2fa);

  const [step, setStep] = useState('credentials'); // 'credentials' | 'totp'
  const [form, setForm] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (values) => {
    const errors = {};
    if (!values.username.trim()) errors.username = t('auth.errors.usernameRequired');
    if (!values.password) errors.password = t('auth.errors.passwordRequired');
    return errors;
  };

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));
  const touchAll = () => setTouched({ username: true, password: true });

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    touchAll();
    if (!isValid) return;
    setServerError('');
    setLoading(true);
    try {
      const result = await login(form);
      if (result?.requires2fa) {
        setStep('totp');
      } else {
        navigate('/chat');
      }
    } catch (err) {
      setServerError(err.message || t('auth.errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel2fa = () => {
    cancelPending2fa();
    setStep('credentials');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background to-background-secondary p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-accent/30">
            <MessageCircle className="h-7 w-7 text-accent-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
            <p className="mt-1 text-sm text-muted">
              {step === 'totp' ? t('auth.twoFactorTitle') : t('auth.loginTitle')}
            </p>
          </div>
        </div>

        <Card className="shadow-xl">
          <Card.Content className="p-6">
            {step === 'totp' ? (
              <TotpStep onCancel={handleCancel2fa} />
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                {/* Server error */}
                {serverError && (
                  <div className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger">
                    <AlertCircle size={16} className="shrink-0" />
                    {serverError}
                  </div>
                )}

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

                <Button type="submit" isPending={loading} className="mt-1 w-full">
                  {({ isPending }) =>
                    isPending ? (
                      <><Spinner size="sm" /><span>{t('auth.loggingIn')}</span></>
                    ) : (
                      t('auth.login')
                    )
                  }
                </Button>
              </form>
            )}
          </Card.Content>
        </Card>

        {step === 'credentials' && (
          <p className="mt-6 text-center text-sm text-muted">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-medium text-accent hover:underline">
              {t('auth.registerFree')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
