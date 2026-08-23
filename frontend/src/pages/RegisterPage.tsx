import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, InputGroup, TextField, Label, FieldError, Description, Button, Spinner } from '@heroui/react';
import { Eye, EyeOff, AlertCircle, Check, X, Lock } from 'lucide-react';
import AuthLayout from '@/layouts/AuthLayout';
import { EASE_OUT } from '@/lib/motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/endpoints';
import type { RegisterRequest } from '@/types/auth';

const PASSWORD_RULES: { key: string; test: (p: string) => boolean }[] = [
  { key: 'minLength', test: (p) => p.length >= 8 },
  { key: 'uppercase', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', test: (p) => /[a-z]/.test(p) },
  { key: 'number', test: (p) => /\d/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
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
  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  // null = aún consultando; true/false = resultado del backend.
  const [regAllowed, setRegAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    authApi.getRegistrationStatus()
      .then((res) => { if (alive) setRegAllowed(res.data?.allow_registration !== false); })
      .catch(() => { if (alive) setRegAllowed(true); }); // ante error, no bloqueamos el formulario
    return () => { alive = false; };
  }, []);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof typeof form, string>> = {};
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

  const touch = (field: keyof typeof form) => setTouched((prev) => ({ ...prev, [field]: true }));
  const touchAll = () =>
    setTouched({ username: true, display_name: true, email: true, password: true, confirmPassword: true });

  const updateField = (field: keyof typeof form) => (e: { target: { value: string } }) => {
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
      const payload: RegisterRequest = {
        username: form.username,
        display_name: form.display_name,
        password: form.password,
        ...(form.email ? { email: form.email } : {}),
        ...(form.department ? { department: form.department } : {}),
        ...(form.job_title ? { job_title: form.job_title } : {}),
      };
      await register(payload);
      navigate('/login');
    } catch (err) {
      setServerError((err instanceof Error && err.message) || t('auth.errors.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (regAllowed === false) {
    return (
      <AuthLayout>
        <Card className="echo-glass-strong">
          <Card.Content className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-default text-muted">
              <Lock size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('auth.registrationDisabledTitle')}</h2>
              <p className="mt-1 text-sm text-muted">{t('auth.registrationDisabled')}</p>
            </div>
            <Button onPress={() => navigate('/login')} className="w-full">{t('auth.goLogin')}</Button>
          </Card.Content>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      subtitle={t('auth.registerTitle')}
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            {t('auth.goLogin')}
          </Link>
        </p>
      }
    >
      <Card className="echo-glass-strong">
        <Card.Content className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <AnimatePresence initial={false}>
                {serverError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                    className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger"
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    {serverError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Username */}
              <TextField fullWidth isRequired isInvalid={touched.username && !!errors.username}>
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
                {touched.username && !!errors.username
                  ? <FieldError>{errors.username}</FieldError>
                  : <Description>{t('auth.usernameHint')}</Description>
                }
              </TextField>

              {/* Display name */}
              <TextField fullWidth isRequired isInvalid={touched.display_name && !!errors.display_name}>
                <Label>{t('auth.displayName')}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input
                    placeholder={t('auth.displayNamePlaceholder')}
                    value={form.display_name}
                    onChange={updateField('display_name')}
                    onBlur={() => touch('display_name')}
                    autoComplete="name"
                  />
                </InputGroup>
                {touched.display_name && <FieldError>{errors.display_name}</FieldError>}
              </TextField>

              {/* Email */}
              <TextField fullWidth isInvalid={touched.email && !!errors.email}>
                <Label>
                  {t('auth.email')}{' '}
                  <span className="text-muted font-normal text-xs">({t('common.optional')})</span>
                </Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={form.email}
                    onChange={updateField('email')}
                    onBlur={() => touch('email')}
                    autoComplete="email"
                  />
                </InputGroup>
                {touched.email && <FieldError>{errors.email}</FieldError>}
              </TextField>

              {/* Dept + Job */}
              <div className="flex gap-3 overflow-hidden">
                <TextField className="flex-1 min-w-0">
                  <Label>{t('auth.department')}</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Input
                      placeholder={t('auth.departmentPlaceholder')}
                      value={form.department}
                      onChange={updateField('department')}
                    />
                  </InputGroup>
                </TextField>
                <TextField className="flex-1 min-w-0">
                  <Label>{t('auth.jobTitle')}</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Input
                      placeholder={t('auth.jobTitlePlaceholder')}
                      value={form.job_title}
                      onChange={updateField('job_title')}
                    />
                  </InputGroup>
                </TextField>
              </div>

              {/* Password */}
              <TextField fullWidth isRequired isInvalid={touched.password && !!errors.password}>
                <Label>{t('auth.password')}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input
                    placeholder={t('auth.passwordPlaceholder')}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={updateField('password')}
                    onBlur={() => touch('password')}
                    autoComplete="new-password"
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
                {form.password && <PasswordStrength password={form.password} />}
                {!form.password && touched.password && <FieldError>{errors.password}</FieldError>}
              </TextField>

              {/* Confirm password */}
              <TextField fullWidth isRequired isInvalid={touched.confirmPassword && !!errors.confirmPassword}>
                <Label>{t('auth.confirmPassword')}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input
                    placeholder={t('auth.passwordPlaceholder')}
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={updateField('confirmPassword')}
                    onBlur={() => touch('confirmPassword')}
                    autoComplete="new-password"
                  />
                  {form.confirmPassword && (
                    <InputGroup.Suffix>
                      <span className={form.password === form.confirmPassword ? 'text-success' : 'text-danger'}>
                        {form.password === form.confirmPassword ? <Check size={16} /> : <X size={16} />}
                      </span>
                    </InputGroup.Suffix>
                  )}
                </InputGroup>
                {touched.confirmPassword && <FieldError>{errors.confirmPassword}</FieldError>}
              </TextField>

              <motion.div
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.1 }}
                className="mt-1"
              >
                <Button type="submit" isPending={loading} className="w-full">
                  {({ isPending }) =>
                    isPending ? (
                      <><Spinner size="sm" /><span>{t('auth.registering')}</span></>
                    ) : (
                      t('auth.register')
                    )
                  }
                </Button>
              </motion.div>
            </form>
        </Card.Content>
      </Card>
    </AuthLayout>
  );
}
