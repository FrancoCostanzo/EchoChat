import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Input, Button, Separator, Spinner } from '@heroui/react';
import { MessageCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-danger">
      <AlertCircle size={12} />
      {message}
    </p>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

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
      await login(form);
      navigate('/chat');
    } catch (err) {
      setServerError(err.message || t('auth.errors.loginFailed'));
    } finally {
      setLoading(false);
    }
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
            <p className="mt-1 text-sm text-muted">{t('auth.loginTitle')}</p>
          </div>
        </div>

        <Card className="p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {/* Server error */}
            {serverError && (
              <div className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger">
                <AlertCircle size={16} className="shrink-0" />
                {serverError}
              </div>
            )}

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t('auth.username')}
              </label>
              <Input
                placeholder={t('auth.usernamePlaceholder')}
                value={form.username}
                onChange={updateField('username')}
                onBlur={() => touch('username')}
                autoFocus
                autoComplete="username"
                className={touched.username && errors.username ? 'border-danger' : ''}
              />
              {touched.username && <FieldError message={errors.username} />}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('auth.password')}</label>
              </div>
              <div className="relative">
                <Input
                  placeholder={t('auth.passwordPlaceholder')}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={updateField('password')}
                  onBlur={() => touch('password')}
                  autoComplete="current-password"
                  className={`pr-10 ${touched.password && errors.password ? 'border-danger' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {touched.password && <FieldError message={errors.password} />}
            </div>

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
        </Card>

        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            {t('auth.registerFree')}
          </Link>
        </p>
      </div>
    </div>
  );
}
