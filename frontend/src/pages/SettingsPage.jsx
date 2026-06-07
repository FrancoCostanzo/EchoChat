import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Input, Button, Spinner, InputOTP, REGEXP_ONLY_DIGITS } from '@heroui/react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Monitor,
  Save,
  Sun,
  Moon,
  Palette,
  Globe,
  Check,
  AlertCircle,
  Lock,
  Wifi,
  WifiOff,
  Clock,
  MinusCircle,
  BellOff,
  Camera,
  ArrowLeft,
  User,
  Shield,
  Smartphone,
  ShieldCheck,
  ShieldOff,
  QrCode,
  Copy,
  RefreshCw,
  KeyRound,
} from 'lucide-react';

function parseUserAgent(ua) {
  if (!ua) return { browser: null, os: null };
  let browser = 'Browser';
  let os = null;

  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';

  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { browser, os };
}
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { usersApi, authApi } from '@/lib/endpoints';
import UserAvatar from '@/components/UserAvatar';
import { useThemeStore, ACCENT_COLORS } from '@/stores/themeStore';
import { changeLanguage } from '@/lib/i18n';

const ENTRY_EASE = [0.34, 1.2, 0.64, 1];
const BOUNCE_EASE = [0.34, 1.56, 0.64, 1];

function AnimatedAlert({ children, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedCheck({ children, className }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0, rotate: -20 }}
      animate={{ opacity: 1, scale: [0, 1.3, 0.9, 1], rotate: [-20, 6, -2, 0] }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.28, ease: BOUNCE_EASE }}
      className={className}
    >
      {children}
    </motion.span>
  );
}

function ProfileTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const avatarInputRef = useRef(null);

  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    email: user?.email || '',
    department: user?.department || '',
    job_title: user?.job_title || '',
    phone_extension: user?.phone_extension || '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const { data } = await usersApi.updateProfile(form);
      updateUser(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setAvatarError('');
    setAvatarSuccess(false);
    try {
      const { data } = await usersApi.uploadAvatar(file);
      updateUser(data);
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (err) {
      setAvatarError(err.message || t('settings.avatarError'));
      setTimeout(() => setAvatarError(''), 3000);
    } finally {
      setAvatarLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Avatar hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background-secondary">
        <div className="h-20 bg-linear-to-br from-accent-soft to-transparent" />
        <div className="-mt-8 flex items-end gap-4 px-5 pb-5">
          <div className="relative">
            <div className="rounded-full ring-4 ring-background">
              <UserAvatar user={user} size="lg" showStatus />
            </div>
            <Button
              variant="ghost"
              onPress={() => avatarInputRef.current?.click()}
              isDisabled={avatarLoading}
              className="absolute inset-0 flex h-full w-full items-center justify-center rounded-full bg-black/40 p-0 opacity-0 transition-opacity hover:bg-black/40 hover:opacity-100 disabled:cursor-not-allowed"
              title={t('settings.changeAvatar')}
            >
              {avatarLoading ? (
                <Spinner size="sm" color="white" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="pb-1">
            <p className="font-semibold leading-tight">{user?.display_name}</p>
            <p className="text-sm text-muted">@{user?.username}</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {avatarSuccess && (
          <AnimatedAlert className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
            <Check size={15} />
            {t('settings.avatarUpdated')}
          </AnimatedAlert>
        )}
        {avatarError && (
          <AnimatedAlert className="flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertCircle size={15} />
            {avatarError}
          </AnimatedAlert>
        )}
      </AnimatePresence>

      {/* Form card */}
      <div className="rounded-2xl border border-border bg-background-secondary p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
          {t('settings.profile')}
        </h3>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">{t('settings.name')}</label>
              <Input value={form.display_name} onChange={updateField('display_name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">{t('settings.email')}</label>
              <Input type="email" value={form.email} onChange={updateField('email')} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">{t('settings.department')}</label>
              <Input value={form.department} onChange={updateField('department')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">{t('settings.jobTitle')}</label>
              <Input value={form.job_title} onChange={updateField('job_title')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('settings.phoneExtension')}</label>
            <Input value={form.phone_extension} onChange={updateField('phone_extension')} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {success && (
          <AnimatedAlert className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
            <Check size={15} />
            {t('settings.profileUpdated')}
          </AnimatedAlert>
        )}
      </AnimatePresence>

      <Button isPending={loading} onPress={handleSave}>
        {({ isPending }) =>
          isPending ? (
            <><Spinner size="sm" color="current" /> {t('settings.saving')}</>
          ) : (
            <><Save size={15} /> {t('settings.saveChanges')}</>
          )
        }
      </Button>
    </div>
  );
}

// ── 2FA card ──────────────────────────────────────────────────────────────────
function TwoFactorCard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  // 'idle' | 'setup' | 'backup-codes' | 'disable' | 'regen' | 'regen-codes'
  const [mode, setMode] = useState('idle');
  const [setupData, setSetupData] = useState(null);       // { qr_url, secret, backup_codes }
  const [backupCodes, setBackupCodes] = useState([]);     // shown once after enable / regen
  const [code, setCode] = useState('');
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const reset = () => { setMode('idle'); setCode(''); setDisableForm({ password: '', code: '' }); setError(''); setSetupData(null); };

  const handleSetup = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.setup2fa();
      setSetupData(data);
      setMode('setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.enable2fa(code.trim());
      setBackupCodes(data.backup_codes);
      updateUser({ totp_enabled: true });
      setMode('backup-codes');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disableForm.password || !disableForm.code) return;
    setError('');
    setLoading(true);
    try {
      await authApi.disable2fa(disableForm.password, disableForm.code);
      updateUser({ totp_enabled: false });
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegen = async () => {
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.regenerateBackupCodes(code.trim());
      setBackupCodes(data.backup_codes);
      setMode('regen-codes');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isEnabled = user?.totp_enabled;

  return (
    <div className="rounded-2xl border border-border bg-background-secondary p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          {isEnabled ? <ShieldCheck size={14} className="text-accent" /> : <Shield size={14} className="text-accent" />}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{t('settings.twoFactor')}</h3>
        </div>
        {isEnabled && mode === 'idle' && (
          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
            {t('settings.twoFactorEnabled')}
          </span>
        )}
      </div>

      {/* ── Idle ── */}
      {mode === 'idle' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {isEnabled ? t('settings.twoFactorEnabledDesc') : t('settings.twoFactorDisabledDesc')}
          </p>
          <div className="flex flex-wrap gap-2">
            {!isEnabled ? (
              <Button size="sm" isPending={loading} onPress={handleSetup}>
                {({ isPending }) => isPending
                  ? <><Spinner size="sm" color="current" /> {t('common.loading')}</>
                  : <><ShieldCheck size={14} /> {t('settings.enable2fa')}</>}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="danger" onPress={() => setMode('disable')}>
                  <ShieldOff size={14} /> {t('settings.disable2fa')}
                </Button>
                <Button size="sm" variant="secondary" onPress={() => { setMode('regen'); setCode(''); setError(''); }}>
                  <RefreshCw size={14} /> {t('settings.regenerateBackupCodes')}
                </Button>
              </>
            )}
          </div>
          <AnimatePresence>
            {error && (
              <AnimatedAlert className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertCircle size={14} /> {error}
              </AnimatedAlert>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Setup: scan QR ── */}
      {mode === 'setup' && setupData && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('settings.scan2faQr')}</p>
          <div className="flex justify-center">
            <img src={setupData.qr_code} alt="QR Code" className="h-44 w-44 rounded-xl border border-border" />
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2.5">
            <p className="mb-1 text-xs text-muted">{t('settings.manualEntry')}</p>
            <div className="flex items-center justify-between gap-2">
              <code className="break-all text-sm font-mono tracking-widest text-foreground select-all">
                {setupData.secret}
              </code>
              <Button
                isIconOnly
                variant="ghost"
                onPress={copySecret}
                className="h-auto w-auto min-w-0 shrink-0 p-0 text-muted hover:bg-transparent hover:text-foreground"
                title={t('common.copy')}
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('settings.enterTotpCode')}</label>
            <InputOTP
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              value={code}
              onChange={setCode}
              isInvalid={!!error}
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
          </div>
          <AnimatePresence>
            {error && (
              <AnimatedAlert className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertCircle size={14} /> {error}
              </AnimatedAlert>
            )}
          </AnimatePresence>
          <div className="flex gap-2">
            <Button isPending={loading} onPress={handleEnable}>
              {({ isPending }) => isPending
                ? <><Spinner size="sm" color="current" /> {t('common.loading')}</>
                : <><Check size={14} /> {t('settings.confirmEnable2fa')}</>}
            </Button>
            <Button variant="ghost" onPress={reset}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}

      {/* ── Backup codes (shown once) ── */}
      {(mode === 'backup-codes' || mode === 'regen-codes') && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
            <KeyRound size={14} className="mt-0.5 shrink-0" />
            <span>{t('settings.backupCodesWarning')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((c, i) => (
              <code key={i} className="rounded-lg border border-border bg-background px-3 py-2 text-center font-mono text-sm tracking-widest">
                {c}
              </code>
            ))}
          </div>
          <Button onPress={reset}>{t('common.done')}</Button>
        </div>
      )}

      {/* ── Disable 2FA ── */}
      {mode === 'disable' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('settings.disable2faDesc')}</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('settings.currentPassword')}</label>
            <Input
              type="password"
              value={disableForm.password}
              onChange={(e) => setDisableForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('settings.enterTotpCode')}</label>
            <InputOTP
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              value={disableForm.code}
              onChange={(val) => setDisableForm((f) => ({ ...f, code: val }))}
              isInvalid={!!error}
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
          </div>
          <AnimatePresence>
            {error && (
              <AnimatedAlert className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertCircle size={14} /> {error}
              </AnimatedAlert>
            )}
          </AnimatePresence>
          <div className="flex gap-2">
            <Button variant="danger" isPending={loading} onPress={handleDisable}>
              {({ isPending }) => isPending
                ? <><Spinner size="sm" color="current" /> {t('common.loading')}</>
                : t('settings.disable2fa')}
            </Button>
            <Button variant="ghost" onPress={reset}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}

      {/* ── Regenerate backup codes ── */}
      {mode === 'regen' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('settings.regenerateDesc')}</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('settings.enterTotpCode')}</label>
            <InputOTP
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              value={code}
              onChange={setCode}
              isInvalid={!!error}
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
          </div>
          <AnimatePresence>
            {error && (
              <AnimatedAlert className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertCircle size={14} /> {error}
              </AnimatedAlert>
            )}
          </AnimatePresence>
          <div className="flex gap-2">
            <Button isPending={loading} onPress={handleRegen}>
              {({ isPending }) => isPending
                ? <><Spinner size="sm" color="current" /> {t('common.loading')}</>
                : t('settings.regenerateBackupCodes')}
            </Button>
            <Button variant="ghost" onPress={reset}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SecurityTab() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRevokeAllPrompt, setShowRevokeAllPrompt] = useState(false);

  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');
    if (form.new_password !== form.confirm) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess(t('settings.passwordUpdated'));
      setShowRevokeAllPrompt(true);
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await authApi.getSessions();
      setSessions(data);
    } catch {
      // silently ignore fetch errors in sessions list
    }
  };

  const revokeSession = async (id) => {
    await authApi.revokeSession(id);
    fetchSessions();
  };

  const revokeAllOthers = async () => {
    setRevokeAllLoading(true);
    try {
      await authApi.logoutAll(true); // keepCurrent=true
      setShowRevokeAllPrompt(false);
      fetchSessions();
    } finally {
      setRevokeAllLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* Change password card */}
      <div className="rounded-2xl border border-border bg-background-secondary p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
            <Lock size={14} className="text-accent" />
          </div>
          <h3 className="text-sm font-semibold">{t('settings.changePassword')}</h3>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('settings.currentPassword')}</label>
            <Input type="password" value={form.current_password} onChange={updateField('current_password')} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">{t('settings.newPassword')}</label>
              <Input type="password" value={form.new_password} onChange={updateField('new_password')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">{t('settings.confirmNewPassword')}</label>
              <Input type="password" value={form.confirm} onChange={updateField('confirm')} />
            </div>
          </div>
          <AnimatePresence>
            {error && (
              <AnimatedAlert className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertCircle size={14} />
                {error}
              </AnimatedAlert>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {success && !showRevokeAllPrompt && (
              <AnimatedAlert className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
                <Check size={14} />
                {success}
              </AnimatedAlert>
            )}
            {showRevokeAllPrompt && (
              <AnimatedAlert className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm">
                <p className="font-medium text-foreground">{t('settings.passwordUpdated')} — {t('settings.revokeAllPrompt')}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" isPending={revokeAllLoading} onPress={revokeAllOthers}>
                    {({ isPending }) => isPending
                      ? <><Spinner size="sm" color="current" /> {t('settings.revoking')}</>
                      : t('settings.revokeOtherSessions')}
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => setShowRevokeAllPrompt(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </AnimatedAlert>
            )}
          </AnimatePresence>
          <Button isPending={loading} onPress={handleChangePassword}>
            {({ isPending }) =>
              isPending ? (
                <><Spinner size="sm" color="current" /> {t('settings.updating')}</>
              ) : (
                t('settings.updatePassword')
              )
            }
          </Button>
        </div>
      </div>

      {/* 2FA card */}
      <TwoFactorCard />

      {/* Active sessions card */}
      <div className="rounded-2xl border border-border bg-background-secondary p-5">
        <div className="mb-4 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <Monitor size={14} className="text-accent" />
            </div>
            <h3 className="text-sm font-semibold">{t('settings.activeSessions')}</h3>
          </div>
          {sessions.filter((s) => !s.is_current).length > 0 && (
            <Button size="sm" variant="danger" isPending={revokeAllLoading} onPress={revokeAllOthers}>
              {({ isPending }) => isPending
                ? <Spinner size="sm" color="current" />
                : t('settings.revokeOtherSessions')}
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {sessions.map((s) => {
            const { browser, os } = parseUserAgent(s.user_agent);
            const isMobile = /iPhone|iPad|Android/.test(s.user_agent || '');
            const DeviceIcon = isMobile ? Smartphone : Monitor;
            const label = s.device_name
              || (browser && os ? `${browser} · ${os}` : browser || s.device_type || t('settings.device'));
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  s.is_current
                    ? 'border-accent/40 bg-accent-soft'
                    : 'border-border bg-background'
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-secondary">
                  <DeviceIcon size={16} className={s.is_current ? 'text-accent' : 'text-muted'} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{label}</p>
                    {s.is_current && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                        {t('settings.currentSession')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted">{s.ip_address}</p>
                </div>
                {!s.is_current && (
                  <Button size="sm" variant="danger" onPress={() => revokeSession(s.id)}>
                    {t('settings.closeSession')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const THEME_MODES = [
  { key: 'light', icon: Sun },
  { key: 'dark', icon: Moon },
  { key: 'system', icon: Monitor },
];

function AppearanceTab() {
  const { t } = useTranslation();
  const { mode, accent, setMode, setAccent } = useThemeStore();

  return (
    <div className="flex flex-col gap-5">
      {/* Theme mode card */}
      <div className="rounded-2xl border border-border bg-background-secondary p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
            <Sun size={14} className="text-accent" />
          </div>
          <h3 className="text-sm font-semibold">{t('settings.theme')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {THEME_MODES.map(({ key, icon: Icon }) => (
            <Button
              key={key}
              variant="ghost"
              onPress={() => setMode(key)}
              className={`relative flex h-auto flex-col items-center gap-2.5 rounded-xl border-2 p-4 [--button-bg-hover:transparent] [--button-bg-pressed:transparent] hover:scale-[1.03] active:scale-[0.96] ${
                mode === key
                  ? 'border-accent bg-accent-soft text-accent shadow-sm scale-[1.03]'
                  : 'border-border text-muted hover:border-border-secondary hover:text-foreground'
              }`}
            >
              <AnimatePresence>
                {mode === key && (
                  <AnimatedCheck className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
                    <Check size={10} strokeWidth={3} className="text-accent-foreground" />
                  </AnimatedCheck>
                )}
              </AnimatePresence>
              <Icon size={22} />
              <span className="text-xs font-medium">{t(`settings.${key}`)}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Accent color card */}
      <div className="rounded-2xl border border-border bg-background-secondary p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
            <Palette size={14} className="text-accent" />
          </div>
          <h3 className="text-sm font-semibold">{t('settings.accentColor')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ACCENT_COLORS.map(({ key, color }) => (
            <Button
              key={key}
              variant="ghost"
              onPress={() => setAccent(key)}
              className={`flex h-auto items-center justify-start gap-3 rounded-xl border-2 p-3 [--button-bg-hover:transparent] [--button-bg-pressed:transparent] hover:scale-[1.03] active:scale-[0.96] ${
                accent === key
                  ? 'border-accent bg-accent-soft shadow-sm scale-[1.03]'
                  : 'border-border hover:border-border-secondary'
              }`}
            >
              <motion.span
                animate={accent === key ? { scale: [1, 1.18, 0.92, 1] } : { scale: 1 }}
                transition={{ duration: 0.3, ease: BOUNCE_EASE }}
                className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background"
                style={{ backgroundColor: color, ringColor: color }}
              >
                <AnimatePresence>
                  {accent === key && (
                    <AnimatedCheck className="text-white">
                      <Check size={12} strokeWidth={3} />
                    </AnimatedCheck>
                  )}
                </AnimatePresence>
              </motion.span>
              <span className="text-sm font-medium">{t(`settings.accentColors.${key}`)}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PRESENCE_OPTIONS = [
  { key: 'online',  dotClass: 'bg-success', icon: Wifi },
  { key: 'away',    dotClass: 'bg-warning', icon: Clock },
  { key: 'busy',    dotClass: 'bg-danger',  icon: MinusCircle },
  { key: 'dnd',     dotClass: 'bg-danger',  icon: BellOff },
  { key: 'offline', dotClass: 'bg-muted',   icon: WifiOff },
];

function PresenceTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [presence, setPresence] = useState(user?.presence || 'online');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (value) => {
    setPresence(value);
    setLoading(true);
    try {
      await usersApi.updatePresence(value);
      updateUser({ presence: value });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background-secondary p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          <Wifi size={14} className="text-accent" />
        </div>
        <h3 className="text-sm font-semibold">{t('settings.presenceStatus')}</h3>
      </div>
      <div className="flex flex-col gap-2">
        {PRESENCE_OPTIONS.map(({ key, dotClass, icon: Icon }) => (
          <Button
            key={key}
            variant="ghost"
            isDisabled={loading}
            onPress={() => handleUpdate(key)}
            className={`flex h-auto items-center justify-start gap-3 rounded-xl border-2 px-4 py-3 text-left [--button-bg-hover:transparent] [--button-bg-pressed:transparent] hover:scale-[1.01] active:scale-[0.98] ${
              presence === key
                ? 'border-accent bg-accent-soft scale-[1.01]'
                : 'border-border hover:border-border-secondary'
            }`}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
            <Icon size={15} className="shrink-0 text-muted" />
            <span className="flex-1 text-sm font-medium">{t(`settings.presenceOptions.${key}`)}</span>
            <AnimatePresence>
              {presence === key && (
                <AnimatedCheck className="text-accent">
                  <Check size={14} />
                </AnimatedCheck>
              )}
            </AnimatePresence>
          </Button>
        ))}
      </div>
    </div>
  );
}

const LANGUAGES = [
  { key: 'es', label: 'Español',    flag: '🇪🇸', region: 'Latinoamérica / España' },
  { key: 'en', label: 'English',    flag: '🇺🇸', region: 'United States' },
  { key: 'pt', label: 'Português',  flag: '🇧🇷', region: 'Brasil' },
];

function LanguageTab() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  return (
    <div className="rounded-2xl border border-border bg-background-secondary p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          <Globe size={14} className="text-accent" />
        </div>
        <h3 className="text-sm font-semibold">{t('settings.language')}</h3>
      </div>
      <div className="flex flex-col gap-2">
        {LANGUAGES.map(({ key, label, flag, region }) => (
          <Button
            key={key}
            variant="ghost"
            onPress={() => changeLanguage(key)}
            className={`flex h-auto items-center justify-start gap-4 rounded-xl border-2 px-4 py-3 [--button-bg-hover:transparent] [--button-bg-pressed:transparent] hover:scale-[1.01] active:scale-[0.98] ${
              currentLang === key
                ? 'border-accent bg-accent-soft scale-[1.01]'
                : 'border-border hover:border-border-secondary'
            }`}
          >
            <span className="text-2xl leading-none">{flag}</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted">{region}</p>
            </div>
            <AnimatePresence>
              {currentLang === key && (
                <AnimatedCheck className="text-accent">
                  <Check size={14} />
                </AnimatedCheck>
              )}
            </AnimatePresence>
          </Button>
        ))}
      </div>
    </div>
  );
}

const TAB_COMPONENTS = {
  profile:    ProfileTab,
  appearance: AppearanceTab,
  language:   LanguageTab,
  security:   SecurityTab,
  presence:   PresenceTab,
};

const MOBILE_SETTINGS_NAV = [
  { id: 'profile',    icon: User    },
  { id: 'appearance', icon: Palette },
  { id: 'language',   icon: Globe   },
  { id: 'security',   icon: Shield  },
  { id: 'presence',   icon: Wifi    },
];

export default function SettingsPage() {
  const { tab = 'profile' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const TabContent = TAB_COMPONENTS[tab] || ProfileTab;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Mobile settings header */}
      <div className="flex items-center gap-2 border-b border-separator px-3 py-3 md:hidden">
        <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-sm font-semibold">{t('settings.title')}</h2>
      </div>

      {/* Mobile tab navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-separator px-3 py-2 md:hidden">
        {MOBILE_SETTINGS_NAV.map(({ id, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            onPress={() => navigate(`/settings/${id}`)}
            className={`flex h-auto shrink-0 items-center justify-start gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:bg-default'
            }`}
          >
            <Icon size={13} />
            {t(`settings.tabs.${id}`)}
          </Button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 18, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: ENTRY_EASE }}
          className="mx-auto w-full max-w-xl px-4 py-4 md:px-6 md:py-6"
        >
          <div className="mb-5 hidden md:block">
            <h1 className="text-xl font-bold text-foreground">{t(`settings.tabs.${tab}`)}</h1>
            <p className="mt-0.5 text-sm text-muted">{t(`settings.descriptions.${tab}`)}</p>
          </div>
          <TabContent />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


