import { useState } from 'react';
import { Input, Button, Tabs, Separator, Select, ListBox, Label, Spinner } from '@heroui/react';
import {
  User,
  Shield,
  Monitor,
  Save,
  LogOut,
  Trash2,
  Sun,
  Moon,
  Palette,
  Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { usersApi, authApi } from '@/lib/endpoints';
import UserAvatar from '@/components/UserAvatar';
import { useThemeStore, ACCENT_COLORS } from '@/stores/themeStore';
import { changeLanguage } from '@/lib/i18n';

function ProfileTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    email: user?.email || '',
    department: user?.department || '',
    job_title: user?.job_title || '',
    phone_extension: user?.phone_extension || '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <UserAvatar user={user} size="lg" />
        <div>
          <p className="font-semibold">{user?.display_name}</p>
          <p className="text-sm text-muted">@{user?.username}</p>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted">{t('settings.name')}</label>
        <Input value={form.display_name} onChange={updateField('display_name')} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted">{t('settings.email')}</label>
        <Input type="email" value={form.email} onChange={updateField('email')} />
      </div>
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm text-muted">{t('settings.department')}</label>
          <Input value={form.department} onChange={updateField('department')} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm text-muted">{t('settings.jobTitle')}</label>
          <Input value={form.job_title} onChange={updateField('job_title')} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted">{t('settings.phoneExtension')}</label>
        <Input value={form.phone_extension} onChange={updateField('phone_extension')} />
      </div>

      {success && (
        <div className="rounded-lg bg-success-soft p-3 text-sm text-success">
          {t('settings.profileUpdated')}
        </div>
      )}

      <Button isPending={loading} onPress={handleSave}>
        {({ isPending }) => isPending ? <><Spinner size="sm" color="current" /> {t('settings.saving')}</> : <><Save size={16} /> {t('settings.saveChanges')}</>}
      </Button>
    </div>
  );
}

function SecurityTab() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    const { data } = await authApi.getSessions();
    setSessions(data);
  };

  const revokeSession = async (id) => {
    await authApi.revokeSession(id);
    fetchSessions();
  };

  useState(() => {
    fetchSessions();
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('settings.changePassword')}</h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">{t('settings.currentPassword')}</label>
            <Input type="password" value={form.current_password} onChange={updateField('current_password')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">{t('settings.newPassword')}</label>
            <Input type="password" value={form.new_password} onChange={updateField('new_password')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">{t('settings.confirmNewPassword')}</label>
            <Input type="password" value={form.confirm} onChange={updateField('confirm')} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}
          <Button isPending={loading} onPress={handleChangePassword}>
            {({ isPending }) => isPending ? <><Spinner size="sm" color="current" /> {t('settings.updating')}</> : t('settings.updatePassword')}
          </Button>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('settings.activeSessions')}</h3>
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg bg-background-secondary p-3">
              <Monitor size={18} className="text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {s.device_name || s.device_type || t('settings.device')}
                </p>
                <p className="text-xs text-muted">{s.ip_address}</p>
              </div>
              <Button
                size="sm"
                variant="danger"
                onPress={() => revokeSession(s.id)}
              >
                {t('settings.closeSession')}
              </Button>
            </div>
          ))}
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
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('settings.theme')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {THEME_MODES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                mode === key
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border hover:border-border-secondary'
              }`}
            >
              <Icon size={22} />
              <span className="text-xs font-medium">{t(`settings.${key}`)}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('settings.accentColor')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {ACCENT_COLORS.map(({ key, color }) => (
            <button
              key={key}
              onClick={() => setAccent(key)}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                accent === key
                  ? 'border-accent bg-accent-soft'
                  : 'border-border hover:border-border-secondary'
              }`}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background"
                style={{ backgroundColor: color, ringColor: accent === key ? color : 'transparent' }}
              />
              <span className="text-sm font-medium">{t(`settings.accentColors.${key}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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

  const presenceOptions = [
    { key: 'online', label: t('settings.presenceOptions.online') },
    { key: 'away', label: t('settings.presenceOptions.away') },
    { key: 'busy', label: t('settings.presenceOptions.busy') },
    { key: 'dnd', label: t('settings.presenceOptions.dnd') },
    { key: 'offline', label: t('settings.presenceOptions.offline') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">{t('settings.presenceStatus')}</h3>
      <Select
        placeholder={t('settings.selectStatus')}
        isDisabled={loading}
        value={presence}
        onChange={(value) => handleUpdate(value)}
      >
        <Label>{t('settings.status')}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {presenceOptions.map((opt) => (
              <ListBox.Item key={opt.key} id={opt.key} textValue={opt.label}>
                {opt.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

const LANGUAGES = [
  { key: 'es', label: 'Español', flag: '🇪🇸' },
  { key: 'en', label: 'English', flag: '🇺🇸' },
  { key: 'pt', label: 'Português', flag: '🇧🇷' },
];

function LanguageTab() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">{t('settings.language')}</h3>
      <div className="grid grid-cols-1 gap-3">
        {LANGUAGES.map(({ key, label, flag }) => (
          <button
            key={key}
            onClick={() => changeLanguage(key)}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
              currentLang === key
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border hover:border-border-secondary'
            }`}
          >
            <span className="text-xl">{flag}</span>
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('profile');
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-separator px-4 py-3">
        <h2 className="text-base font-semibold">{t('settings.title')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg">
          <Tabs selectedKey={tab} onSelectionChange={setTab} className="mb-4">
            <Tabs.List aria-label={t('settings.title')}>
              <Tabs.Tab id="profile">
                <User size={14} />
                <span>{t('settings.tabs.profile')}</span>
              </Tabs.Tab>
              <Tabs.Tab id="appearance">
                <Palette size={14} />
                <span>{t('settings.tabs.appearance')}</span>
              </Tabs.Tab>
              <Tabs.Tab id="language">
                <Globe size={14} />
                <span>{t('settings.tabs.language')}</span>
              </Tabs.Tab>
              <Tabs.Tab id="security">
                <Shield size={14} />
                <span>{t('settings.tabs.security')}</span>
              </Tabs.Tab>
              <Tabs.Tab id="presence">
                <Monitor size={14} />
                <span>{t('settings.tabs.presence')}</span>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {tab === 'profile' && <ProfileTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'language' && <LanguageTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'presence' && <PresenceTab />}
        </div>
      </div>
    </div>
  );
}
