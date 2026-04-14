import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Input, Button, Spinner } from '@heroui/react';
import { MessageCircle, Eye, EyeOff, AlertCircle, Check, X } from 'lucide-react';
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

const PASSWORD_RULES = [
  { key: 'minLength', test: (p) => p.length >= 8 },
  { key: 'uppercase', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', test: (p) => /[a-z]/.test(p) },
  { key: 'number', test: (p) => /\d/.test(p) },
];

function PasswordStrength({ password }) {
  const { t } = useTranslation();
  if (!password) return null;
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const colors = ['bg-danger', 'bg-warning', 'bg-warning', 'bg-success'];
  const labels = [
    t('auth.passwordStrength.veryWeak'),
    t('auth.passwordStrength.weak'),
    t('auth.passwordStrength.fair'),
    t('auth.passwordStrength.strong'),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {PASSWORD_RULES.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < passed ? colors[passed - 1] : 'bg-default'}`}
          />
        ))}
      </div>
      <p className={`text-xs ${passed >= 4 ? 'text-success' : passed >= 2 ? 'text-warning' : 'text-danger'}`}>
        {labels[passed - 1] ?? t('auth.passwordStrength.veryWeak')}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <p key={rule.key} className={`flex items-center gap-1 text-xs ${ok ? 'text-success' : 'text-muted'}`}>
              {ok ? <Check size={11} /> : <X size={11} />}
              {t(`auth.passwordRules.${rule.key}`)}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [form, setForm] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    job_title: '',
  });
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const errors = useMemo(() => {
    const e = {};
    if (!form.username.trim()) {
      e.username = t('auth.errors.usernameRequired');
    } else if (!/^[a-zA-Z0-9._]+$/.test(form.username)) {
      e.username = t('auth.errors.usernameInvalid');
    } else if (form.username.length < 3) {
      e.username = t('auth.errors.usernameMinLength');
    }

    if (!form.display_name.trim()) e.display_name = t('auth.errors.displayNameRequired');

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = t('auth.errors.emailInvalid');
    }

    const passOk = PASSWORD_RULES.every((r) => r.test(form.password));
    if (!form.password) {
      e.password = t('auth.errors.passwordRequired');
    } else if (!passOk) {
      e.password = t('auth.errors.passwordWeak');
    }

    if (!form.confirmPassword) {
      e.confirmPassword = t('auth.errors.confirmRequired');
    } else if (form.password !== form.confirmPassword) {
      e.confirmPassword = t('auth.errors.passwordMismatch');
    }

    return e;
  }, [form, t]);

  const isValid = Object.keys(errors).length === 0;

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));
  const touchAll = () =>
    setTouched({ username: true, display_name: true, email: true, password: true, confirmPassword: true });

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
      const { confirmPassword, ...data } = form;
      // Remove empty optional fields
      if (!data.email) delete data.email;
      if (!data.department) delete data.department;
      if (!data.job_title) delete data.job_title;
      await register(data);
      navigate('/login');
    } catch (err) {
      setServerError(err.message || t('auth.errors.registerFailed'));
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
            <p className="mt-1 text-sm text-muted">{t('auth.registerTitle')}</p>
          </div>
        </div>

        <Card className="p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {serverError && (
              <div className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger">
                <AlertCircle size={16} className="shrink-0" />
                {serverError}
              </div>
            )}

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t('auth.username')} <span className="text-danger">*</span>
              </label>
              <Input
                placeholder={t('auth.usernamePlaceholder')}
                value={form.username}
                onChange={updateField('username')}
                onBlur={() => touch('username')}
                autoFocus
                autoComplete="username"
              />
              {touched.username && errors.username ? (
                <FieldError message={errors.username} />
              ) : (
                <p className="text-xs text-muted">{t('auth.usernameHint')}</p>
              )}
            </div>

            {/* Display name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t('auth.displayName')} <span className="text-danger">*</span>
              </label>
              <Input
                placeholder={t('auth.displayNamePlaceholder')}
                value={form.display_name}
                onChange={updateField('display_name')}
                onBlur={() => touch('display_name')}
                autoComplete="name"
              />
              {touched.display_name && <FieldError message={errors.display_name} />}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('auth.email')} <span className="text-muted font-normal text-xs">({t('common.optional')})</span></label>
              <Input
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={form.email}
                onChange={updateField('email')}
                onBlur={() => touch('email')}
                autoComplete="email"
              />
              {touched.email && <FieldError message={errors.email} />}
            </div>

            {/* Dept + Job */}
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-sm font-medium">{t('auth.department')}</label>
                <Input
                  placeholder={t('auth.departmentPlaceholder')}
                  value={form.department}
                  onChange={updateField('department')}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-sm font-medium">{t('auth.jobTitle')}</label>
                <Input
                  placeholder={t('auth.jobTitlePlaceholder')}
                  value={form.job_title}
                  onChange={updateField('job_title')}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t('auth.password')} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Input
                  placeholder={t('auth.passwordPlaceholder')}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={updateField('password')}
                  onBlur={() => touch('password')}
                  autoComplete="new-password"
                  className="pr-10"
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
              {form.password && <PasswordStrength password={form.password} />}
              {touched.password && !form.password && <FieldError message={errors.password} />}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {t('auth.confirmPassword')} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Input
                  placeholder={t('auth.passwordPlaceholder')}
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={updateField('confirmPassword')}
                  onBlur={() => touch('confirmPassword')}
                  autoComplete="new-password"
                  className="pr-10"
                />
                {form.confirmPassword && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${form.password === form.confirmPassword ? 'text-success' : 'text-danger'}`}>
                    {form.password === form.confirmPassword ? <Check size={16} /> : <X size={16} />}
                  </span>
                )}
              </div>
              {touched.confirmPassword && <FieldError message={errors.confirmPassword} />}
            </div>

            <Button type="submit" isPending={loading} className="mt-1 w-full">
              {({ isPending }) =>
                isPending ? (
                  <><Spinner size="sm" /><span>{t('auth.registering')}</span></>
                ) : (
                  t('auth.register')
                )
              }
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            {t('auth.goLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
