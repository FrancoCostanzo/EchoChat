import { useState, useRef, useEffect, useCallback, type ReactNode, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Input,
  Button,
  Spinner,
  InputOTP,
  REGEXP_ONLY_DIGITS,
  Switch,
  Tooltip,
  toast,
  Slider,
  Label,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  ListBox,
} from '@heroui/react';
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
  Bell,
  BellOff,
  Camera,
  ArrowLeft,
  User,
  Shield,
  Smartphone,
  ShieldCheck,
  ShieldOff,
  Copy,
  RefreshCw,
  KeyRound,
  Image as ImageIcon,
  MoonStar,
  Volume2,
  Play,
  Download,
  Trash2,
  Mail,
  Phone,
  PhoneIncoming,
  Video,
  Mic,
  AudioLines,
  type LucideIcon,
} from 'lucide-react';

function parseUserAgent(ua: string | null | undefined): { browser: string | null; os: string | null } {
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
import { usersApi, authApi, notificationsApi } from '@/lib/endpoints';
import { isElectron } from '@/lib/runtimeConfig';
import {
  canInstall,
  disablePush,
  enablePush,
  getCurrentSubscription,
  getPushState,
  isIos,
  isStandalone,
  onInstallAvailabilityChange,
  promptInstall,
  type PushState,
} from '@/lib/push';
import { useNotificationStore, isDndActive } from '@/stores/notificationStore';
import { MESSAGE_SOUND_NAMES, playMessageSound, RINGTONE_NAMES, previewRingtone } from '@/lib/sounds';
import {
  audioConstraints,
  canChooseSpeaker,
  getDevicePrefs,
  setDevicePref,
  videoConstraints,
  type DevicePrefs,
} from '@/lib/mediaPrefs';
import { NOTIFICATION_EVENT_GROUPS } from '@/lib/notificationEvents';
import UserAvatar from '@/components/UserAvatar';
import AvatarCropModal from '@/components/AvatarCropModal';
import { useThemeStore, ACCENT_COLORS, type ThemeMode } from '@/stores/themeStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import WallpaperPicker, { WallpaperPreview } from '@/components/WallpaperPicker';
import { changeLanguage } from '@/lib/i18n';
import type { SessionResponse, Setup2faResponse } from '@/types/auth';
import type {
  NotificationPrefsRequest,
  NotificationSettings,
  NotificationSettingsRequest,
  PushDevice,
  PushPreview,
  PushWhen,
  EmailDigest,
} from '@/types/notification';

type WallpaperScope = 'global' | 'type' | 'conversation';

const ENTRY_EASE = [0.34, 1.2, 0.64, 1] as const;
const BOUNCE_EASE = [0.34, 1.56, 0.64, 1] as const;

function AnimatedAlert({ children, className }: { children: ReactNode; className?: string }) {
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

function AnimatedCheck({ children, className }: { children: ReactNode; className?: string }) {
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

/** Card shell for settings sections — Spatial Canvas surface */
function SettingsCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="echo-panel-solid echo-e1 rounded-2xl border border-(--panel-border) p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <Icon size={14} className="text-accent" />
        </div>
        <h3 className="echo-display text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/**
 * Unified option button for settings pickers (theme, accent, language, presence).
 * Always full-width; checkmark in a consistent position when selected.
 */
function SettingsOptionButton({
  selected,
  onPress,
  disabled = false,
  variant = 'row',
  children,
  className = '',
}: {
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'row' | 'tile';
  children: ReactNode;
  className?: string;
}) {
  const isTile = variant === 'tile';

  return (
    <Button
      variant="ghost"
      isDisabled={disabled}
      onPress={onPress}
      className={[
        'relative !box-border !flex !w-full !max-w-none !h-auto min-h-[44px] rounded-xl border transition-colors duration-150',
        '[--button-bg-hover:transparent] [--button-bg-pressed:transparent]',
        selected
          ? 'border-accent/55 bg-accent/10 echo-ring-soft text-foreground'
          : 'border-white/8 bg-ink-800/45 text-ink-100 hover:border-white/14 hover:bg-ink-750/65 hover:text-foreground',
        isTile
          ? '!flex-col !items-center !justify-center gap-2.5 !px-3 !py-5 min-h-[96px]'
          : '!flex-row !items-center !justify-start gap-3 !px-4 !py-3.5 text-left',
        className,
      ].join(' ')}
    >
      {children}
      <AnimatePresence>
        {selected && (
          <AnimatedCheck
            className={
              isTile
                ? 'pointer-events-none absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground'
                : 'pointer-events-none ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground'
            }
          >
            <Check size={11} strokeWidth={3} />
          </AnimatedCheck>
        )}
      </AnimatePresence>
    </Button>
  );
}

function ProfileTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('avatar.jpg');
  const cropObjectUrlRef = useRef<string | null>(null);

  const closeCropModal = () => {
    setCropOpen(false);
    setCropImageSrc(null);
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }
  };

  useEffect(() => () => {
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
    }
  }, []);

  const updateField = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
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

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    cropObjectUrlRef.current = objectUrl;
    setCropFileName(file.name || 'avatar.jpg');
    setCropImageSrc(objectUrl);
    setCropOpen(true);
  };

  const handleAvatarCropConfirm = async (file: File) => {
    setAvatarLoading(true);
    setAvatarError('');
    setAvatarSuccess(false);
    try {
      const { data } = await usersApi.uploadAvatar(file);
      updateUser(data);
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
      closeCropModal();
    } catch (err) {
      setAvatarError((err instanceof Error && err.message) || t('settings.avatarError'));
      setTimeout(() => setAvatarError(''), 3000);
    } finally {
      setAvatarLoading(false);
    }
  };

  const avatarInputId = 'profile-avatar-input';

  return (
    <div className="flex flex-col gap-5">
      {/* Avatar hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background-secondary">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-accent-soft/55 via-accent-soft/15 to-transparent"
          aria-hidden
        />
        <div className="relative flex items-center gap-4 px-5 py-5">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
            <UserAvatar
              user={user}
              size="lg"
              showStatus
              className="ring-4 ring-background"
            />
            <label
              htmlFor={avatarInputId}
              className={[
                'absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-full bg-black/45 transition-opacity',
                avatarLoading ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:hover:opacity-100',
              ].join(' ')}
              aria-label={t('settings.changeAvatar')}
            >
              {avatarLoading ? (
                <Spinner size="sm" color="current" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </label>
            <input
              id={avatarInputId}
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={avatarLoading}
              onChange={handleAvatarChange}
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{user?.display_name}</p>
            <p className="text-sm text-muted">@{user?.username}</p>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => avatarInputRef.current?.click()}
              isDisabled={avatarLoading}
              className="mt-1 h-auto min-h-0 px-0 text-xs font-medium text-accent hover:text-accent"
            >
              {t('settings.changeAvatar')}
            </Button>
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

      <AvatarCropModal
        isOpen={cropOpen}
        imageSrc={cropImageSrc}
        fileName={cropFileName}
        onClose={closeCropModal}
        onConfirm={handleAvatarCropConfirm}
        loading={avatarLoading}
      />

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

  type Mode = 'idle' | 'setup' | 'backup-codes' | 'disable' | 'regen' | 'regen-codes';
  const [mode, setMode] = useState<Mode>('idle');
  const [setupData, setSetupData] = useState<Setup2faResponse | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);     // shown once after enable / regen
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
      setError(err instanceof Error ? err.message : '');
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
      setError(err instanceof Error ? err.message : '');
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
      setError(err instanceof Error ? err.message : '');
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
      setError(err instanceof Error ? err.message : '');
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
              <Tooltip delay={0}>
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={copySecret}
                  className="h-auto w-auto min-w-0 shrink-0 p-0 text-muted hover:bg-transparent hover:text-foreground"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </Button>
                <Tooltip.Content>{t('common.copy')}</Tooltip.Content>
              </Tooltip>
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
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRevokeAllPrompt, setShowRevokeAllPrompt] = useState(false);

  const updateField = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
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
      setError(err instanceof Error ? err.message : '');
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

  const revokeSession = async (id: string) => {
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

const THEME_MODES: { key: ThemeMode; icon: LucideIcon }[] = [
  { key: 'light', icon: Sun },
  { key: 'dark', icon: Moon },
  { key: 'system', icon: Monitor },
];

const CONV_TYPE_ROWS: { scope: WallpaperScope; scopeKey: string; labelKey: string }[] = [
  { scope: 'global', scopeKey: 'global', labelKey: 'wallpaper.scopeGlobal' },
  { scope: 'type', scopeKey: 'direct',      labelKey: 'wallpaper.typeDirect' },
  { scope: 'type', scopeKey: 'group',       labelKey: 'wallpaper.typeGroup' },
  { scope: 'type', scopeKey: 'channel',     labelKey: 'wallpaper.typeChannel' },
  { scope: 'type', scopeKey: 'broadcast',   labelKey: 'wallpaper.typeBroadcast' },
  { scope: 'type', scopeKey: 'bot',         labelKey: 'wallpaper.typeBot' },
];

interface WallpaperPickerTarget {
  scope: WallpaperScope;
  scopeKey: string;
  label: string;
}

function AppearanceTab() {
  const { t } = useTranslation();
  const { mode, accent, setMode, setAccent } = useThemeStore();
  const { wallpapers, fetchWallpapers } = useWallpaperStore();
  const [pickerOpen, setPickerOpen] = useState<WallpaperPickerTarget | null>(null);

  useEffect(() => {
    fetchWallpapers();
  }, [fetchWallpapers]);

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard icon={Sun} title={t('settings.theme')}>
        <div className="grid grid-cols-3 gap-2">
          {THEME_MODES.map(({ key, icon: Icon }) => (
            <SettingsOptionButton
              key={key}
              selected={mode === key}
              onPress={() => setMode(key)}
              variant="tile"
            >
              <Icon size={22} className="shrink-0 text-current" />
              <span className="text-xs font-semibold">{t(`settings.${key}`)}</span>
            </SettingsOptionButton>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard icon={Palette} title={t('settings.accentColor')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACCENT_COLORS.map(({ key, color }) => (
            <SettingsOptionButton
              key={key}
              selected={accent === key}
              onPress={() => setAccent(key)}
            >
              <span
                className="flex h-7 w-7 shrink-0 rounded-full ring-1 ring-white/15"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {t(`settings.accentColors.${key}`)}
              </span>
            </SettingsOptionButton>
          ))}
        </div>
      </SettingsCard>

      {/* ── Chat wallpapers ── */}
      <SettingsCard icon={ImageIcon} title={t('wallpaper.settingsTitle')}>
        <p className="mb-3 text-xs text-ink-300">{t('wallpaper.settingsHint')}</p>
        <div className="flex flex-col gap-2">
          {CONV_TYPE_ROWS.map(({ scope, scopeKey, labelKey }) => {
            const current = wallpapers.find(
              (w) => w.scope === scope && w.scope_key === scopeKey
            );
            const label = t(labelKey);
            return (
              <button
                key={`${scope}:${scopeKey}`}
                onClick={() => setPickerOpen({ scope, scopeKey, label })}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-ink-800/45 px-4 py-3 text-left transition-colors hover:border-white/14 hover:bg-ink-750/65"
              >
                <WallpaperPreview
                  wallpaper={current}
                  className="h-10 w-14 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-ink-300">
                    {current
                      ? t(`wallpaper.type_${current.wallpaper_type}`)
                      : t('wallpaper.notSet')}
                  </p>
                </div>
                <Palette size={15} className="shrink-0 text-ink-300" />
              </button>
            );
          })}
        </div>
      </SettingsCard>

      {pickerOpen && (
        <WallpaperPicker
          isOpen={!!pickerOpen}
          onClose={() => setPickerOpen(null)}
          scope={pickerOpen.scope}
          scopeKey={pickerOpen.scopeKey}
          label={pickerOpen.label}
        />
      )}
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

  const handleUpdate = async (value: string) => {
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
    <div className="flex flex-col gap-4">
    <SettingsCard icon={Wifi} title={t('settings.presenceStatus')}>
      <div className="flex flex-col gap-2">
        {PRESENCE_OPTIONS.map(({ key, dotClass, icon: Icon }) => (
          <SettingsOptionButton
            key={key}
            selected={presence === key}
            disabled={loading}
            onPress={() => handleUpdate(key)}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
            <Icon size={15} className="shrink-0 text-ink-200" />
            <span className="min-w-0 flex-1 text-sm font-medium">
              {t(`settings.presenceOptions.${key}`)}
            </span>
          </SettingsOptionButton>
        ))}
      </div>
    </SettingsCard>
    <AwayCard />
    </div>
  );
}

/**
 * Estado de ausencia: un texto, hasta cuándo, y si además se responde solo en
 * los chats directos. Es el mismo `presence_message` que se ve al lado del
 * nombre — a propósito, para no mantener dos redacciones del mismo aviso.
 */
function AwayCard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const activa = !!user?.presence_message;
  const [mensaje, setMensaje] = useState(user?.presence_message || '');
  // <input type="datetime-local"> quiere "YYYY-MM-DDTHH:mm" en hora local.
  const [hasta, setHasta] = useState(() => {
    if (!user?.away_until) return '';
    const d = new Date(user.away_until);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [autoReply, setAutoReply] = useState(!!user?.auto_reply_enabled);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!mensaje.trim()) return;
    setGuardando(true);
    try {
      const { data } = await usersApi.setAway({
        message: mensaje.trim(),
        until: hasta ? new Date(hasta).toISOString() : null,
        auto_reply: autoReply,
      });
      updateUser({
        presence: data.presence,
        presence_message: data.presence_message,
        away_until: data.away_until,
        auto_reply_enabled: data.auto_reply_enabled,
      });
      toast.success(t('settings.away.saved'));
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
    } finally {
      setGuardando(false);
    }
  };

  const limpiar = async () => {
    setGuardando(true);
    try {
      const { data } = await usersApi.clearAway();
      setMensaje('');
      setHasta('');
      setAutoReply(false);
      updateUser({
        presence: data.presence,
        presence_message: null,
        away_until: null,
        auto_reply_enabled: false,
      });
      toast.success(t('settings.away.cleared'));
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SettingsCard icon={Clock} title={t('settings.away.title')}>
      <p className="mb-4 text-xs text-ink-200">{t('settings.away.description')}</p>

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-200">
            {t('settings.away.message')}
          </label>
          <Input
            value={mensaje}
            maxLength={200}
            placeholder={t('settings.away.messagePlaceholder')}
            onChange={(e) => setMensaje(e.target.value)}
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-200">
            {t('settings.away.until')}
          </label>
          <Input
            type="datetime-local"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-full"
          />
          <p className="mt-1 text-xs text-ink-200">{t('settings.away.untilHint')}</p>
        </div>

        <Switch isSelected={autoReply} isDisabled={guardando} onChange={setAutoReply}>
          <Switch.Control><Switch.Thumb /></Switch.Control>
          <Switch.Content>{t('settings.away.autoReply')}</Switch.Content>
        </Switch>
        <p className="-mt-1 text-xs text-ink-200">{t('settings.away.autoReplyHint')}</p>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            isPending={guardando}
            isDisabled={!mensaje.trim()}
            onPress={guardar}
          >
            {t('settings.away.save')}
          </Button>
          {activa && (
            <Button variant="ghost" isDisabled={guardando} onPress={limpiar}>
              {t('settings.away.clear')}
            </Button>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}

const LANGUAGES = [
  { key: 'es', code: 'ES', label: 'Español', region: 'Latinoamérica / España' },
  { key: 'en', code: 'EN', label: 'English', region: 'United States' },
  { key: 'pt', code: 'PT', label: 'Português', region: 'Brasil' },
];

function LanguageTab() {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || 'es').split('-')[0];

  return (
    <SettingsCard icon={Globe} title={t('settings.language')}>
      <div className="flex flex-col gap-2">
        {LANGUAGES.map(({ key, code, label, region }) => (
          <SettingsOptionButton
            key={key}
            selected={currentLang === key}
            onPress={() => changeLanguage(key)}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-xs font-bold tracking-wide text-foreground">
              {code}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{label}</p>
              <p className="truncate text-xs text-ink-200">{region}</p>
            </div>
          </SettingsOptionButton>
        ))}
      </div>
    </SettingsCard>
  );
}

/** Lunes primero, que es como se lee una semana laboral. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function formatTimeForInput(value: string | null | undefined) {
  if (!value) return '';
  const str = String(value);
  return str.length >= 5 ? str.slice(0, 5) : str;
}

/** Fin del "no molestar" según la opción elegida; null = hasta desactivarlo. */
function dndUntil(option: string): string | null {
  const now = new Date();
  if (option === '1h') return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  if (option === '8h') return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
  if (option === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return tomorrow.toISOString();
  }
  return null;
}

/** Push del navegador en este dispositivo + los demás dispositivos suscriptos. */
function PushSettingsCard({
  settings,
  save,
}: {
  settings: NotificationSettings;
  save: (patch: NotificationSettingsRequest) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const channels = useNotificationStore((s) => s.channels);
  const [state, setState] = useState<PushState | null>(null);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [currentTail, setCurrentTail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [installable, setInstallable] = useState(canInstall());

  const refresh = useCallback(async () => {
    const [nextState, subscription, list] = await Promise.all([
      getPushState(),
      getCurrentSubscription().catch(() => null),
      notificationsApi.getPushDevices().then((r) => r.data).catch(() => [] as PushDevice[]),
    ]);
    setState(nextState);
    setCurrentTail(subscription ? subscription.endpoint.slice(-24) : null);
    setDevices(list);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => onInstallAvailabilityChange(() => setInstallable(canInstall())), []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.danger(t('settings.notifications.saveError'));
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const sendTest = () => run(async () => {
    const { data } = await notificationsApi.testPush();
    if (data.delivered > 0) toast.success(t('settings.notifications.pushCard.testSent'));
    else toast.warning(t('settings.notifications.pushCard.testNone'));
  });

  if (!channels.push) return null;

  const electron = isElectron();
  const statusText = electron
    ? t('settings.notifications.pushCard.desktop')
    : state === 'unsupported'
      ? (isIos() && !isStandalone() ? t('settings.notifications.pushCard.iosHint') : t('settings.notifications.pushCard.unsupported'))
      : state === 'denied'
        ? t('settings.notifications.pushCard.denied')
        : state === 'on'
          ? t('settings.notifications.pushCard.on')
          : t('settings.notifications.pushCard.off');

  return (
    <SettingsCard icon={Smartphone} title={t('settings.notifications.pushCard.title')}>
      <p className="mb-4 text-xs text-ink-200">{t('settings.notifications.pushCard.desc')}</p>

      <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-ink-800/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-foreground">{state === null && !electron ? <Spinner size="sm" /> : statusText}</div>
        {!electron && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {state === 'off' && (
              <Button size="sm" isPending={busy} onPress={() => run(async () => {
                const result = await enablePush();
                if (result === 'denied') toast.warning(t('settings.notifications.pushCard.denied'));
              })}>
                {t('settings.notifications.pushCard.enable')}
              </Button>
            )}
            {state === 'on' && (
              <>
                <Button size="sm" variant="secondary" isPending={busy} onPress={sendTest}>
                  {t('settings.notifications.pushCard.test')}
                </Button>
                <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => run(disablePush)}>
                  {t('settings.notifications.pushCard.disable')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {installable && !isStandalone() && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-100">{t('settings.notifications.pushCard.installDesc')}</p>
          <Button size="sm" variant="secondary" onPress={() => void promptInstall()}>
            <Download size={14} />
            {t('settings.notifications.pushCard.install')}
          </Button>
        </div>
      )}

      {devices.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.notifications.pushCard.devices')}</p>
          <div className="flex flex-col gap-2">
            {devices.map((device) => {
              const { browser, os } = parseUserAgent(device.user_agent);
              const isThis = currentTail !== null && device.endpoint_tail === currentTail;
              return (
                <div key={device.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-800/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {[browser, os].filter(Boolean).join(' · ') || t('settings.notifications.pushCard.unknownDevice')}
                      {isThis && <span className="ml-2 text-xs text-accent">{t('settings.notifications.pushCard.thisDevice')}</span>}
                    </p>
                    <p className="text-xs text-ink-300">
                      {device.last_used_at
                        ? t('settings.notifications.pushCard.lastUsed', {
                            date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
                              .format(new Date(device.last_used_at)),
                          })
                        : t('settings.notifications.pushCard.neverUsed')}
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={t('settings.notifications.pushCard.remove')}
                    isDisabled={busy}
                    onPress={() => run(async () => {
                      if (isThis) await disablePush();
                      else await notificationsApi.removePushDevice(device.id);
                    })}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.notifications.pushCard.preview')}</p>
      <ToggleButtonGroup
        aria-label={t('settings.notifications.pushCard.preview')}
        selectionMode="single"
        disallowEmptySelection
        size="sm"
        className="flex-wrap"
        selectedKeys={new Set([settings.push_preview])}
        onSelectionChange={(keys) => {
          const value = [...keys][0] as PushPreview | undefined;
          if (value && value !== settings.push_preview) void save({ push_preview: value });
        }}
      >
        {(['full', 'sender', 'none'] as const).map((value, i) => (
          <ToggleButton key={value} id={value}>
            {i > 0 && <ToggleButtonGroup.Separator />}
            {t(`settings.notifications.pushCard.previewOptions.${value}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.notifications.pushCard.when')}</p>
      <ToggleButtonGroup
        aria-label={t('settings.notifications.pushCard.when')}
        selectionMode="single"
        disallowEmptySelection
        size="sm"
        className="flex-wrap"
        selectedKeys={new Set([settings.push_when])}
        onSelectionChange={(keys) => {
          const value = [...keys][0] as PushWhen | undefined;
          if (value && value !== settings.push_when) void save({ push_when: value });
        }}
      >
        {(['inactive', 'always'] as const).map((value, i) => (
          <ToggleButton key={value} id={value}>
            {i > 0 && <ToggleButtonGroup.Separator />}
            {t(`settings.notifications.pushCard.whenOptions.${value}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <div className="mt-5">
        <Switch isSelected={settings.badge_enabled} onChange={(v) => save({ badge_enabled: v })}>
          <Switch.Control><Switch.Thumb /></Switch.Control>
          <Switch.Content>{t('settings.notifications.pushCard.badge')}</Switch.Content>
        </Switch>
      </div>
    </SettingsCard>
  );
}

/** Preferencias de los emails: resumen periódico, espera para avisar pendientes e idioma. */
function EmailSettingsCard({
  settings,
  save,
}: {
  settings: NotificationSettings;
  save: (patch: NotificationSettingsRequest) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const channels = useNotificationStore((s) => s.channels);
  const email = useAuthStore((s) => s.user?.email);

  if (!channels.email) return null;

  const hourLabel = (hour: number) =>
    new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(2024, 0, 1, hour));

  return (
    <SettingsCard icon={Mail} title={t('settings.notifications.emailCard.title')}>
      <p className="mb-4 text-xs text-ink-200">
        {email
          ? t('settings.notifications.emailCard.desc', { email })
          : t('settings.notifications.emailCard.noEmail')}
      </p>
      {!email && (
        <Button size="sm" variant="secondary" className="mb-4" onPress={() => navigate('/settings/profile')}>
          {t('settings.notifications.emailCard.addEmail')}
        </Button>
      )}

      <div className={email ? '' : 'pointer-events-none opacity-50'}>
        <p className="mb-2 text-xs font-medium text-ink-200">{t('settings.notifications.emailCard.delay')}</p>
        <ToggleButtonGroup
          aria-label={t('settings.notifications.emailCard.delay')}
          selectionMode="single"
          disallowEmptySelection
          isDetached
          size="sm"
          className="flex-wrap"
          selectedKeys={new Set([String(settings.email_unread_delay_minutes)])}
          onSelectionChange={(keys) => {
            const value = Number([...keys][0]) as NotificationSettings['email_unread_delay_minutes'];
            if (value && value !== settings.email_unread_delay_minutes) void save({ email_unread_delay_minutes: value });
          }}
        >
          {[15, 30, 60, 120].map((minutes) => (
            <ToggleButton key={minutes} id={String(minutes)}>
              {minutes < 60
                ? t('settings.notifications.emailCard.minutes', { count: minutes })
                : t('settings.notifications.emailCard.hours', { count: minutes / 60 })}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <p className="mt-2 text-xs text-ink-300">{t('settings.notifications.emailCard.delayHint')}</p>

        <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.notifications.emailCard.digest')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ToggleButtonGroup
            aria-label={t('settings.notifications.emailCard.digest')}
            selectionMode="single"
            disallowEmptySelection
            isDetached
            size="sm"
            className="flex-wrap"
            selectedKeys={new Set([settings.email_digest])}
            onSelectionChange={(keys) => {
              const value = [...keys][0] as EmailDigest | undefined;
              if (value && value !== settings.email_digest) void save({ email_digest: value });
            }}
          >
            {(['off', 'hourly', 'daily', 'weekly'] as const).map((value) => (
              <ToggleButton key={value} id={value}>
                {t(`settings.notifications.emailCard.digestOptions.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {(settings.email_digest === 'daily' || settings.email_digest === 'weekly') && (
            <Select
              aria-label={t('settings.notifications.emailCard.digestHour')}
              className="w-36"
              value={String(settings.email_digest_hour)}
              onChange={(value) => void save({ email_digest_hour: Number(value) })}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <ListBox.Item key={hour} id={String(hour)} textValue={hourLabel(hour)}>
                      {hourLabel(hour)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </div>
        {settings.email_digest === 'weekly' && (
          <p className="mt-2 text-xs text-ink-300">{t('settings.notifications.emailCard.weeklyHint')}</p>
        )}

        <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.notifications.emailCard.language')}</p>
        <ToggleButtonGroup
          aria-label={t('settings.notifications.emailCard.language')}
          selectionMode="single"
          disallowEmptySelection
          isDetached
          size="sm"
          className="flex-wrap"
          selectedKeys={new Set([settings.email_locale ?? 'auto'])}
          onSelectionChange={(keys) => {
            const value = String([...keys][0] ?? 'auto');
            const locale = value === 'auto' ? null : value;
            if (locale !== settings.email_locale) void save({ email_locale: locale });
          }}
        >
          {['auto', 'es', 'en', 'pt'].map((value) => (
            <ToggleButton key={value} id={value}>
              {t(`settings.notifications.emailCard.languages.${value}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
    </SettingsCard>
  );
}

function NotificationsTab() {
  const { t, i18n } = useTranslation();
  const settings = useNotificationStore((s) => s.settings);
  const events = useNotificationStore((s) => s.events);
  const channels = useNotificationStore((s) => s.channels);
  const loaded = useNotificationStore((s) => s.loaded);
  const load = useNotificationStore((s) => s.load);
  const updateSettings = useNotificationStore((s) => s.updateSettings);
  const updatePreference = useNotificationStore((s) => s.updatePreference);

  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [savingQuiet, setSavingQuiet] = useState(false);

  // Se recarga al entrar: el admin pudo haber cambiado defaults o bloqueos.
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setQuietStart(formatTimeForInput(settings?.quiet_hours_start));
    setQuietEnd(formatTimeForInput(settings?.quiet_hours_end));
  }, [settings?.quiet_hours_start, settings?.quiet_hours_end]);

  const save = async (patch: NotificationSettingsRequest) => {
    try {
      await updateSettings(patch);
    } catch {
      toast.danger(t('settings.notifications.saveError'));
    }
  };

  const savePref = async (patch: NotificationPrefsRequest) => {
    try {
      await updatePreference(patch);
    } catch {
      toast.danger(t('settings.notifications.saveError'));
    }
  };

  const saveQuietHours = async (start: string | null, end: string | null) => {
    setSavingQuiet(true);
    try {
      await save({ quiet_hours_start: start, quiet_hours_end: end });
    } finally {
      setSavingQuiet(false);
    }
  };

  const weekdayName = (day: number) =>
    // 2023-01-01 fue domingo: sumando `day` días se obtiene cada día de la semana.
    new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(new Date(2023, 0, 1 + day));

  if (!loaded || !settings) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const dndActive = isDndActive(settings);

  return (
    <div className="flex flex-col gap-5">
      {/* ── No molestar ── */}
      <SettingsCard icon={MoonStar} title={t('settings.notifications.dnd.title')}>
        <p className="mb-4 text-xs text-ink-200">{t('settings.notifications.dnd.desc')}</p>
        {dndActive ? (
          <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">
              {settings.dnd_until
                ? t('settings.notifications.dnd.activeUntil', {
                    time: new Intl.DateTimeFormat(i18n.language, {
                      weekday: 'short', hour: '2-digit', minute: '2-digit',
                    }).format(new Date(settings.dnd_until)),
                  })
                : t('settings.notifications.dnd.activeIndefinite')}
            </p>
            <Button size="sm" variant="secondary" onPress={() => save({ dnd_enabled: false })}>
              {t('settings.notifications.dnd.turnOff')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {['1h', '8h', 'tomorrow', 'indefinite'].map((option) => (
              <Button
                key={option}
                variant="secondary"
                onPress={() => save({ dnd_enabled: true, dnd_until: dndUntil(option) })}
              >
                {t(`settings.notifications.dnd.options.${option}`)}
              </Button>
            ))}
          </div>
        )}
      </SettingsCard>

      {/* ── Horario y días de silencio ── */}
      <SettingsCard icon={BellOff} title={t('settings.notifications.quietHours')}>
        <p className="mb-4 text-xs text-ink-200">{t('settings.notifications.quietHoursDesc')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-ink-200">
              {t('settings.notifications.quietStart')}
            </label>
            <Input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-ink-200">
              {t('settings.notifications.quietEnd')}
            </label>
            <Input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              isPending={savingQuiet}
              isDisabled={!quietStart || !quietEnd}
              onPress={() => saveQuietHours(quietStart, quietEnd)}
            >
              {t('settings.notifications.saveQuietHours')}
            </Button>
            {(settings.quiet_hours_start || settings.quiet_hours_end) && (
              <Button variant="ghost" onPress={() => saveQuietHours(null, null)}>
                {t('common.clear')}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.notifications.quietDays')}</p>
        <ToggleButtonGroup
          aria-label={t('settings.notifications.quietDays')}
          selectionMode="multiple"
          isDetached
          size="sm"
          className="flex-wrap"
          selectedKeys={new Set(settings.quiet_days.map(String))}
          onSelectionChange={(keys) => save({ quiet_days: [...keys].map(Number).sort() })}
        >
          {WEEK_ORDER.map((day) => (
            <ToggleButton key={day} id={String(day)} className="min-w-12 capitalize">
              {weekdayName(day)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <p className="mt-2 text-xs text-ink-300">{t('settings.notifications.quietDaysDesc')}</p>
      </SettingsCard>

      {/* ── Qué avisar y por dónde ── */}
      <SettingsCard icon={Bell} title={t('settings.notifications.title')}>
        <p className="mb-4 text-xs text-ink-200">{t('settings.notifications.subtitle')}</p>
        {(!channels.push || !channels.email) && (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-ink-200">
            <AlertCircle size={13} className="shrink-0" />
            {!channels.push && !channels.email
              ? t('settings.notifications.channelsOff.both')
              : !channels.push
                ? t('settings.notifications.channelsOff.push')
                : t('settings.notifications.channelsOff.email')}
          </p>
        )}
        <div className="flex flex-col gap-5">
          {NOTIFICATION_EVENT_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                {t(`settings.notifications.groups.${group.id}`)}
              </p>
              <div className="flex flex-col gap-2">
                {group.events.map((eventType) => {
                  const pref = events.find((e) => e.event_type === eventType);
                  if (!pref) return null;
                  const toggles: { key: 'in_app_enabled' | 'push_enabled' | 'email_enabled'; label: string; off: boolean }[] = [
                    { key: 'in_app_enabled', label: t('settings.notifications.inApp'), off: false },
                    { key: 'push_enabled', label: t('settings.notifications.push'), off: !channels.push },
                    { key: 'email_enabled', label: t('settings.notifications.email'), off: !channels.email },
                  ];
                  return (
                    <div
                      key={eventType}
                      className="flex flex-col gap-3 rounded-xl border border-white/8 bg-ink-800/45 px-4 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          {t(`settings.notifications.events.${eventType}`)}
                          {pref.locked && (
                            <Tooltip delay={200}>
                              <Tooltip.Trigger aria-label={t('settings.notifications.locked')}>
                                <Lock size={12} className="text-ink-300" />
                              </Tooltip.Trigger>
                              <Tooltip.Content>{t('settings.notifications.locked')}</Tooltip.Content>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-xs text-ink-300">{t(`settings.notifications.eventDesc.${eventType}`)}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-2">
                        {toggles.map(({ key, label, off }) => (
                          <Switch
                            key={key}
                            size="sm"
                            isSelected={pref[key] && !off}
                            isDisabled={pref.locked || off}
                            onChange={(v) => savePref({ event_type: eventType, [key]: v })}
                          >
                            <Switch.Control><Switch.Thumb /></Switch.Control>
                            <Switch.Content>{label}</Switch.Content>
                          </Switch>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      <PushSettingsCard settings={settings} save={save} />

      <EmailSettingsCard settings={settings} save={save} />

      {/* ── Sonidos ── */}
      <SettingsCard icon={Volume2} title={t('settings.notifications.sound.title')}>
        <Switch
          isSelected={settings.sound_enabled}
          onChange={(v) => save({ sound_enabled: v })}
        >
          <Switch.Control><Switch.Thumb /></Switch.Control>
          <Switch.Content>{t('settings.notifications.sound.enabled')}</Switch.Content>
        </Switch>

        <div className={settings.sound_enabled ? '' : 'pointer-events-none opacity-50'}>
          <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.notifications.sound.choose')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {MESSAGE_SOUND_NAMES.map((name) => (
              <SettingsOptionButton
                key={name}
                variant="tile"
                selected={settings.sound_name === name}
                disabled={!settings.sound_enabled}
                onPress={() => {
                  playMessageSound(name, settings.sound_volume);
                  if (settings.sound_name !== name) void save({ sound_name: name });
                }}
              >
                <Play size={13} className="text-accent" />
                <span className="text-sm">{t(`settings.notifications.sound.names.${name}`)}</span>
              </SettingsOptionButton>
            ))}
          </div>

          <Slider
            className="mt-5 w-full max-w-sm"
            minValue={0}
            maxValue={100}
            step={5}
            isDisabled={!settings.sound_enabled}
            defaultValue={settings.sound_volume}
            onChangeEnd={(value) => {
              const volume = Array.isArray(value) ? value[0] : value;
              playMessageSound(settings.sound_name, volume);
              void save({ sound_volume: volume });
            }}
          >
            <Label className="text-xs font-medium text-ink-200">{t('settings.notifications.sound.volume')}</Label>
            <Slider.Output className="text-xs tabular-nums text-ink-300" />
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
        </div>
      </SettingsCard>
    </div>
  );
}

/** Selector de un tipo de dispositivo; el elegido queda guardado en este navegador. */
function DeviceSelect({
  devices,
  kind,
  label,
  value,
  onChange,
}: {
  devices: MediaDeviceInfo[];
  kind: keyof DevicePrefs;
  label: string;
  value: string | undefined;
  onChange: (kind: keyof DevicePrefs, deviceId: string) => void;
}) {
  const options = devices.filter((d) => d.kind === kind);
  if (options.length === 0) return null;
  return (
    <Select
      className="w-full"
      value={value && options.some((o) => o.deviceId === value) ? value : options[0].deviceId}
      onChange={(next) => onChange(kind, String(next))}
    >
      <Label className="text-xs font-medium text-ink-200">{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((d, i) => (
            <ListBox.Item key={d.deviceId || i} id={d.deviceId} textValue={d.label || `${label} ${i + 1}`}>
              {d.label || `${label} ${i + 1}`}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Elegir micrófono, cámara y parlante, con prueba de micrófono y vista previa de cámara. */
function CallDevicesCard() {
  const { t } = useTranslation();
  const settings = useNotificationStore((s) => s.settings);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [prefs, setPrefs] = useState<DevicePrefs>(getDevicePrefs);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const testStream = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const stopTest = useRef<(() => void) | null>(null);

  const refresh = useCallback(() => {
    navigator.mediaDevices?.enumerateDevices().then(setDevices).catch(() => setDevices([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => () => stopTest.current?.(), []);

  // Sin permiso, el navegador lista los dispositivos sin nombre: hay que pedirlo una vez.
  const hasLabels = devices.some((d) => d.label);

  const askPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
      stream.getTracks().forEach((track) => track.stop());
      refresh();
    } catch {
      toast.danger(t('settings.calls.devices.permissionDenied'));
    }
  };

  const choose = (kind: keyof DevicePrefs, deviceId: string) => {
    setDevicePref(kind, deviceId || null);
    setPrefs(getDevicePrefs());
    if (testing) { stopTest.current?.(); setTesting(false); }
  };

  /** Prende micrófono y cámara elegidos: barra de nivel + vista previa, hasta que se corte. */
  const startTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints(settings, prefs.audioinput),
        video: devices.some((d) => d.kind === 'videoinput') ? videoConstraints(prefs.videoinput) : false,
      });
      testStream.current = stream;
      if (previewRef.current) previewRef.current.srcObject = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let frame = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 64));
        frame = requestAnimationFrame(tick);
      };
      tick();
      stopTest.current = () => {
        cancelAnimationFrame(frame);
        void ctx.close().catch(() => {});
        stream.getTracks().forEach((track) => track.stop());
        testStream.current = null;
        if (previewRef.current) previewRef.current.srcObject = null;
        setLevel(0);
      };
      setTesting(true);
      refresh();
    } catch {
      toast.danger(t('settings.calls.devices.permissionDenied'));
    }
  };

  return (
    <SettingsCard icon={Mic} title={t('settings.calls.devices.title')}>
      <p className="mb-4 text-xs text-ink-200">{t('settings.calls.devices.desc')}</p>
      {!hasLabels ? (
        <Button size="sm" variant="secondary" onPress={askPermission}>{t('settings.calls.devices.allow')}</Button>
      ) : (
        <div className="flex flex-col gap-4">
          <DeviceSelect devices={devices} kind="audioinput" label={t('call.devices.microphone')} value={prefs.audioinput} onChange={choose} />
          <DeviceSelect devices={devices} kind="videoinput" label={t('call.devices.camera')} value={prefs.videoinput} onChange={choose} />
          {canChooseSpeaker() && <DeviceSelect devices={devices} kind="audiooutput" label={t('call.devices.speaker')} value={prefs.audiooutput} onChange={choose} />}

          <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-ink-800/45 p-3 sm:flex-row sm:items-center">
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              className={`aspect-video w-full rounded-lg bg-black object-cover sm:w-48 -scale-x-100 ${testing ? '' : 'hidden'}`}
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700" aria-hidden>
                <div className="h-full rounded-full bg-accent transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
              </div>
              <p className="text-xs text-ink-300">
                {testing ? t('settings.calls.devices.testing') : t('settings.calls.devices.testHint')}
              </p>
            </div>
            <Button
              size="sm"
              variant={testing ? 'ghost' : 'secondary'}
              onPress={() => { if (testing) { stopTest.current?.(); setTesting(false); } else void startTest(); }}
            >
              {testing ? t('settings.calls.devices.stopTest') : t('settings.calls.devices.test')}
            </Button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

function CallsTab() {
  const { t } = useTranslation();
  const settings = useNotificationStore((s) => s.settings);
  const loaded = useNotificationStore((s) => s.loaded);
  const load = useNotificationStore((s) => s.load);
  const updateSettings = useNotificationStore((s) => s.updateSettings);

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);

  const save = async (patch: NotificationSettingsRequest) => {
    try {
      await updateSettings(patch);
    } catch {
      toast.danger(t('settings.notifications.saveError'));
    }
  };

  if (!settings) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  const single = <T extends string>(
    label: string,
    value: T,
    options: readonly T[],
    labelOf: (v: T) => string,
    onChange: (v: T) => void,
  ) => (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      isDetached
      size="sm"
      className="flex-wrap"
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        const next = [...keys][0] as T | undefined;
        if (next && next !== value) onChange(next);
      }}
    >
      {options.map((option) => (
        <ToggleButton key={option} id={option}>{labelOf(option)}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard icon={PhoneIncoming} title={t('settings.calls.incoming.title')}>
        <p className="mb-2 text-xs font-medium text-ink-200">{t('settings.calls.incoming.privacy')}</p>
        {single(
          t('settings.calls.incoming.privacy'),
          settings.call_privacy,
          ['everyone', 'contacts', 'nobody'] as const,
          (v) => t(`settings.calls.incoming.privacyOptions.${v}`),
          (v) => void save({ call_privacy: v }),
        )}
        <p className="mt-2 text-xs text-ink-300">{t('settings.calls.incoming.privacyHint')}</p>

        <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.calls.incoming.dnd')}</p>
        {single(
          t('settings.calls.incoming.dnd'),
          settings.call_dnd_behavior,
          ['silent', 'reject'] as const,
          (v) => t(`settings.calls.incoming.dndOptions.${v}`),
          (v) => void save({ call_dnd_behavior: v }),
        )}

        <p className="mt-5 mb-2 text-xs font-medium text-ink-200">{t('settings.calls.incoming.ringtone')}</p>
        <div className="grid grid-cols-3 gap-2">
          {RINGTONE_NAMES.map((name) => (
            <SettingsOptionButton
              key={name}
              variant="tile"
              selected={settings.ringtone_name === name}
              onPress={() => {
                previewRingtone(name, settings.ringtone_volume);
                if (settings.ringtone_name !== name) void save({ ringtone_name: name });
              }}
            >
              <Play size={13} className="text-accent" />
              <span className="text-sm">{t(`settings.calls.incoming.ringtones.${name}`)}</span>
            </SettingsOptionButton>
          ))}
        </div>
        <Slider
          className="mt-5 w-full max-w-sm"
          minValue={0}
          maxValue={100}
          step={5}
          defaultValue={settings.ringtone_volume}
          onChangeEnd={(value) => {
            const volume = Array.isArray(value) ? value[0] : value;
            previewRingtone(settings.ringtone_name, volume);
            void save({ ringtone_volume: volume });
          }}
        >
          <Label className="text-xs font-medium text-ink-200">{t('settings.calls.incoming.ringtoneVolume')}</Label>
          <Slider.Output className="text-xs tabular-nums text-ink-300" />
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
      </SettingsCard>

      <SettingsCard icon={Video} title={t('settings.calls.joining.title')}>
        <div className="flex flex-col gap-3">
          <Switch isSelected={settings.join_muted} onChange={(v) => save({ join_muted: v })}>
            <Switch.Control><Switch.Thumb /></Switch.Control>
            <Switch.Content>{t('settings.calls.joining.muted')}</Switch.Content>
          </Switch>
          <Switch isSelected={settings.join_camera_off} onChange={(v) => save({ join_camera_off: v })}>
            <Switch.Control><Switch.Thumb /></Switch.Control>
            <Switch.Content>{t('settings.calls.joining.cameraOff')}</Switch.Content>
          </Switch>
        </div>
      </SettingsCard>

      <CallDevicesCard />

      <SettingsCard icon={AudioLines} title={t('settings.calls.audio.title')}>
        <p className="mb-4 text-xs text-ink-200">{t('settings.calls.audio.desc')}</p>
        <div className="flex flex-col gap-3">
          {(['noise_suppression', 'echo_cancellation', 'auto_gain_control'] as const).map((key) => (
            <Switch key={key} isSelected={settings[key]} onChange={(v) => save({ [key]: v })}>
              <Switch.Control><Switch.Thumb /></Switch.Control>
              <Switch.Content>{t(`settings.calls.audio.${key}`)}</Switch.Content>
            </Switch>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

const TAB_COMPONENTS: Record<string, () => ReactNode> = {
  profile:    ProfileTab,
  appearance: AppearanceTab,
  language:   LanguageTab,
  notifications: NotificationsTab,
  calls:      CallsTab,
  security:   SecurityTab,
  presence:   PresenceTab,
};

const MOBILE_SETTINGS_NAV: { id: string; icon: LucideIcon }[] = [
  { id: 'profile',    icon: User    },
  { id: 'appearance', icon: Palette },
  { id: 'language',   icon: Globe   },
  { id: 'notifications', icon: Bell },
  { id: 'calls',      icon: Phone   },
  { id: 'security',   icon: Shield  },
  { id: 'presence',   icon: Wifi    },
];

export default function SettingsPage() {
  const { tab = 'profile' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const TabContent = TAB_COMPONENTS[tab] || ProfileTab;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Mobile settings header */}
      <div className="echo-chat-bg relative z-10 flex shrink-0 items-center gap-2 border-b border-separator px-3 py-3 lg:hidden">
        <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-sm font-semibold">{t('settings.title')}</h2>
      </div>

      {/* Mobile tab navigation */}
      <div className="echo-chat-bg relative z-10 flex shrink-0 gap-1 overflow-x-auto border-b border-separator px-3 py-2 lg:hidden">
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 18, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: ENTRY_EASE }}
            className="w-full px-4 py-4 md:px-6 md:py-6"
          >
            <div className="mb-5 hidden lg:block">
              <h1 className="text-xl font-bold text-foreground">{t(`settings.tabs.${tab}`)}</h1>
              <p className="mt-0.5 text-sm text-muted">{t(`settings.descriptions.${tab}`)}</p>
            </div>
            <TabContent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}


