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
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usersApi, authApi } from '@/lib/endpoints';
import UserAvatar from '@/components/UserAvatar';
import { useThemeStore, ACCENT_COLORS } from '@/stores/themeStore';

function ProfileTab() {
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
        <label className="text-sm text-muted">Nombre</label>
        <Input value={form.display_name} onChange={updateField('display_name')} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted">Email</label>
        <Input type="email" value={form.email} onChange={updateField('email')} />
      </div>
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm text-muted">Departamento</label>
          <Input value={form.department} onChange={updateField('department')} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm text-muted">Cargo</label>
          <Input value={form.job_title} onChange={updateField('job_title')} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted">Extensión telefónica</label>
        <Input value={form.phone_extension} onChange={updateField('phone_extension')} />
      </div>

      {success && (
        <div className="rounded-lg bg-success-soft p-3 text-sm text-success">
          Perfil actualizado correctamente
        </div>
      )}

      <Button isPending={loading} onPress={handleSave}>
        {({ isPending }) => isPending ? <><Spinner size="sm" color="current" /> Guardando...</> : <><Save size={16} /> Guardar cambios</>}
      </Button>
    </div>
  );
}

function SecurityTab() {
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
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess('Contraseña actualizada');
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
        <h3 className="mb-3 text-sm font-semibold">Cambiar contraseña</h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">Contraseña actual</label>
            <Input type="password" value={form.current_password} onChange={updateField('current_password')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">Nueva contraseña</label>
            <Input type="password" value={form.new_password} onChange={updateField('new_password')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">Confirmar nueva contraseña</label>
            <Input type="password" value={form.confirm} onChange={updateField('confirm')} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}
          <Button isPending={loading} onPress={handleChangePassword}>
            {({ isPending }) => isPending ? <><Spinner size="sm" color="current" /> Actualizando...</> : 'Actualizar contraseña'}
          </Button>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold">Sesiones activas</h3>
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg bg-background-secondary p-3">
              <Monitor size={18} className="text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {s.device_name || s.device_type || 'Dispositivo'}
                </p>
                <p className="text-xs text-muted">{s.ip_address}</p>
              </div>
              <Button
                size="sm"
                variant="danger"
                onPress={() => revokeSession(s.id)}
              >
                Cerrar
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const THEME_MODES = [
  { key: 'light', label: 'Claro', icon: Sun },
  { key: 'dark', label: 'Oscuro', icon: Moon },
  { key: 'system', label: 'Sistema', icon: Monitor },
];

function AppearanceTab() {
  const { mode, accent, setMode, setAccent } = useThemeStore();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Tema</h3>
        <div className="grid grid-cols-3 gap-3">
          {THEME_MODES.map(({ key, label, icon: Icon }) => (
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
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold">Color de acento</h3>
        <div className="grid grid-cols-3 gap-3">
          {ACCENT_COLORS.map(({ key, label, color }) => (
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
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PresenceTab() {
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
    { key: 'online', label: 'En línea' },
    { key: 'away', label: 'Ausente' },
    { key: 'busy', label: 'Ocupado' },
    { key: 'dnd', label: 'No molestar' },
    { key: 'offline', label: 'Desconectado' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">Estado de presencia</h3>
      <Select
        placeholder="Seleccionar estado"
        isDisabled={loading}
        value={presence}
        onChange={(value) => handleUpdate(value)}
      >
        <Label>Estado</Label>
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

export default function SettingsPage() {
  const [tab, setTab] = useState('profile');
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-separator px-4 py-3">
        <h2 className="text-base font-semibold">Configuración</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg">
          <Tabs selectedKey={tab} onSelectionChange={setTab} className="mb-4">
            <Tabs.List aria-label="Configuración">
              <Tabs.Tab id="profile">
                <User size={14} />
                <span>Perfil</span>
              </Tabs.Tab>
              <Tabs.Tab id="appearance">
                <Palette size={14} />
                <span>Apariencia</span>
              </Tabs.Tab>
              <Tabs.Tab id="security">
                <Shield size={14} />
                <span>Seguridad</span>
              </Tabs.Tab>
              <Tabs.Tab id="presence">
                <Monitor size={14} />
                <span>Estado</span>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {tab === 'profile' && <ProfileTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'presence' && <PresenceTab />}
        </div>
      </div>
    </div>
  );
}
