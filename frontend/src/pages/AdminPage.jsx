import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Button,
  Card,
  Input,
  InputGroup,
  Modal,
  Spinner,
  Tabs,
  toast,
} from '@heroui/react';
import {
  Shield,
  Users,
  Settings,
  ScrollText,
  HardDrive,
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { useConfirm } from '@/components/ConfirmProvider';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/dates';

const ENTRY_EASE = [0.22, 1, 0.36, 1];
const USER_STATUSES = ['active', 'inactive', 'suspended'];

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function useAdminAccess() {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => {
    const roles = user?.roles || [];
    const perms = user?.permissions || [];
    const isSuper = roles.includes('super_admin');
    return {
      canUsers: isSuper || perms.includes('admin.users'),
      canSettings: isSuper || perms.includes('admin.settings'),
      canAudit: isSuper || perms.includes('admin.view_audit'),
      canStorage: isSuper || perms.includes('admin.storage'),
      canAccess: isSuper || perms.some((p) => p.startsWith('admin.')),
    };
  }, [user]);
}

function AdminCard({ icon: Icon, title, children }) {
  return (
    <Card className="echo-panel-solid flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Icon size={18} />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

/* ── 7.1 Users ── */
function UsersTab({ t }) {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const [usersRes, rolesRes] = await Promise.all([
        adminApi.listUsers(params),
        adminApi.listRoles(),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ username: '', display_name: '', email: '', password: '', department: '', role_names: ['user'] });
    setCreateOpen(true);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({
      display_name: user.display_name,
      email: user.email || '',
      department: user.department || '',
      job_title: user.job_title || '',
      status: user.status,
      role_names: user.roles || ['user'],
    });
  };

  const toggleRole = (name) => {
    setForm((prev) => {
      const current = new Set(prev.role_names || []);
      if (current.has(name)) current.delete(name);
      else current.add(name);
      return { ...prev, role_names: [...current] };
    });
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      await adminApi.createUser(form);
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setBusy(true);
    try {
      await adminApi.updateUser(editUser.id, form);
      setEditUser(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (user) => {
    const ok = await confirm({
      status: 'danger',
      title: t('admin.users.confirmDeleteTitle'),
      message: t('admin.users.confirmDelete', { name: user.display_name }),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    try {
      await adminApi.deleteUser(user.id);
      toast.success(t('admin.users.deleted', { name: user.display_name }));
      await load();
    } catch (err) {
      setError(err.message);
      toast.danger(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-200" />
          <Input className="pl-9" placeholder={t('admin.users.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm"
        >
          <option value="">{t('admin.users.allStatuses')}</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`admin.users.status.${s}`)}</option>
          ))}
        </select>
        <Button className="gap-2" onPress={openCreate}>
          <Plus size={16} /> {t('admin.users.create')}
        </Button>
      </div>

      {error && <p className="text-sm text-echo-dnd">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-700/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ink-800/80 text-xs text-ink-200">
              <tr>
                <th className="px-4 py-3">{t('admin.users.colUser')}</th>
                <th className="px-4 py-3">{t('admin.users.colRoles')}</th>
                <th className="px-4 py-3">{t('admin.users.colStatus')}</th>
                <th className="px-4 py-3">{t('admin.users.colDept')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-ink-700/40 hover:bg-ink-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={u} size="xs" />
                      <div>
                        <p className="font-medium">{u.display_name}</p>
                        <p className="text-xs text-ink-200">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles || []).map((r) => (
                        <span key={r} className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-medium">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      u.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                    }`}>
                      {t(`admin.users.status.${u.status}`, u.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-200">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onPress={() => openEdit(u)}>{t('admin.users.edit')}</Button>
                      <Button size="sm" variant="ghost" isIconOnly aria-label={t('admin.users.delete')} onPress={() => handleDelete(u)}>
                        <Trash2 size={14} className="text-echo-dnd" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('admin.users.createTitle')}
        form={form}
        setForm={setForm}
        roles={roles}
        toggleRole={toggleRole}
        onSave={handleCreate}
        busy={busy}
        isCreate
        t={t}
      />
      <UserFormModal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title={t('admin.users.editTitle')}
        form={form}
        setForm={setForm}
        roles={roles}
        toggleRole={toggleRole}
        onSave={handleUpdate}
        busy={busy}
        t={t}
      />
    </div>
  );
}

function UserFormModal({ open, onClose, title, form, setForm, roles, toggleRole, onSave, busy, isCreate, t }) {
  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
              {isCreate && (
                <>
                  <Field label={t('admin.users.username')}>
                    <Input value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  </Field>
                  <Field label={t('admin.users.password')}>
                    <Input type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </Field>
                </>
              )}
              <Field label={t('admin.users.displayName')}>
                <Input value={form.display_name || ''} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </Field>
              <Field label={t('admin.users.email')}>
                <Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label={t('admin.users.department')}>
                <Input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </Field>
              {!isCreate && (
                <Field label={t('admin.users.statusLabel')}>
                  <select
                    value={form.status || 'active'}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm"
                  >
                    {USER_STATUSES.map((s) => (
                      <option key={s} value={s}>{t(`admin.users.status.${s}`)}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-ink-200">{t('admin.users.roles')}</p>
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => (
                    <label key={r.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink-600 px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={(form.role_names || []).includes(r.name)}
                        onChange={() => toggleRole(r.name)}
                      />
                      {r.display_name || r.name}
                    </label>
                  ))}
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>{t('common.cancel')}</Button>
              <Button isPending={busy} onPress={onSave}>{t('common.save')}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-ink-200">{label}</label>
      {children}
    </div>
  );
}

/* ── 7.2 Settings ── */
function SettingsTab({ t }) {
  const [settings, setSettings] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [valueText, setValueText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSettings();
      setSettings(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const cats = [...new Set(settings.map((s) => s.category).filter(Boolean))];
    return ['all', ...cats.sort()];
  }, [settings]);

  const filtered = category === 'all' ? settings : settings.filter((s) => s.category === category);

  const openEdit = (setting) => {
    setEditing(setting);
    setValueText(typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value, null, 2));
  };

  const handleSave = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      let parsed = valueText;
      try { parsed = JSON.parse(valueText); } catch { /* keep as string */ }
      await adminApi.updateSetting(editing.key, parsed);
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col gap-4">
      <Tabs selectedKey={category} onSelectionChange={setCategory}>
        <Tabs.List aria-label={t('admin.settings.categories')}>
          {categories.map((cat) => (
            <Tabs.Tab key={cat} id={cat}>
              {cat === 'all' ? t('admin.settings.all') : cat}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      <div className="space-y-2">
        {filtered.map((s) => (
          <Card key={s.key} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-medium">{s.key}</p>
              {s.description && <p className="mt-0.5 text-xs text-ink-200">{s.description}</p>}
              <p className="mt-2 truncate font-mono text-xs text-accent">
                {typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
              </p>
            </div>
            <Button size="sm" variant="secondary" onPress={() => openEdit(s)}>{t('admin.settings.edit')}</Button>
          </Card>
        ))}
      </div>

      <Modal isOpen={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{editing?.key}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body>
                <InputGroup>
                  <InputGroup.TextArea
                    className="min-h-32 font-mono text-xs"
                    value={valueText}
                    onChange={(e) => setValueText(e.target.value)}
                  />
                </InputGroup>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setEditing(null)}>{t('common.cancel')}</Button>
                <Button isPending={busy} onPress={handleSave}>{t('common.save')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

/* ── 7.3 Audit ── */
function AuditTab({ t }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (action.trim()) params.action = action.trim();
      if (success) params.success = success;
      const res = await adminApi.getAuditLog(params);
      setEntries(res.data);
    } finally {
      setLoading(false);
    }
  }, [action, success]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Input
          className="min-w-[200px] flex-1"
          placeholder={t('admin.audit.filterAction')}
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <select
          value={success}
          onChange={(e) => setSuccess(e.target.value)}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm"
        >
          <option value="">{t('admin.audit.allResults')}</option>
          <option value="true">{t('admin.audit.success')}</option>
          <option value="false">{t('admin.audit.failed')}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-700/60">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-ink-800/80 text-xs text-ink-200">
              <tr>
                <th className="px-3 py-2">{t('admin.audit.colTime')}</th>
                <th className="px-3 py-2">{t('admin.audit.colActor')}</th>
                <th className="px-3 py-2">{t('admin.audit.colAction')}</th>
                <th className="px-3 py-2">{t('admin.audit.colResource')}</th>
                <th className="px-3 py-2">{t('admin.audit.colResult')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-ink-700/40">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-200">
                    {formatMessageTime(e.created_at)}
                  </td>
                  <td className="px-3 py-2">{e.actor_display_name || e.actor_username || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2 text-xs text-ink-200">
                    {e.resource_type}{e.resource_id ? ` / ${e.resource_id.slice(0, 8)}…` : ''}
                  </td>
                  <td className="px-3 py-2">
                    <span className={e.success ? 'text-emerald-300' : 'text-echo-dnd'}>
                      {e.success ? '✓' : '✗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── 7.4 Storage ── */
function StorageTab({ t }) {
  const [stats, setStats] = useState(null);
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, objectsRes] = await Promise.all([
        adminApi.getStorageStats(),
        adminApi.listStorageObjects({ limit: 30 }),
      ]);
      setStats(statsRes.data);
      setObjects(objectsRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  const summary = stats?.summary || {};

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('admin.storage.totalObjects')} value={summary.total_objects ?? 0} />
        <StatCard label={t('admin.storage.totalSize')} value={formatBytes(summary.total_bytes)} />
        <StatCard label={t('admin.storage.pending')} value={summary.pending_processing ?? 0} />
        <StatCard label={t('admin.storage.failed')} value={summary.failed_processing ?? 0} />
      </div>

      {stats?.by_bucket?.length > 0 && (
        <AdminCard icon={HardDrive} title={t('admin.storage.byBucket')}>
          <div className="space-y-2">
            {stats.by_bucket.map((b) => (
              <div key={b.bucket_name} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{b.bucket_name}</span>
                <span className="text-ink-200">
                  {b.object_count} · {formatBytes(b.total_bytes)}
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      <AdminCard icon={HardDrive} title={t('admin.storage.recentObjects')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead className="text-ink-200">
              <tr>
                <th className="pb-2 pr-3">{t('admin.storage.colFile')}</th>
                <th className="pb-2 pr-3">{t('admin.storage.colBucket')}</th>
                <th className="pb-2 pr-3">{t('admin.storage.colSize')}</th>
                <th className="pb-2">{t('admin.storage.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {objects.map((o) => (
                <tr key={o.id} className="border-t border-ink-700/40">
                  <td className="py-2 pr-3">
                    <p className="truncate font-medium">{o.original_filename || o.object_key}</p>
                    <p className="text-ink-200">{o.uploader_display_name || '—'}</p>
                  </td>
                  <td className="py-2 pr-3 font-mono">{o.bucket_name}</td>
                  <td className="py-2 pr-3">{formatBytes(o.file_size_bytes)}</td>
                  <td className="py-2">{o.processing_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-200">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </Card>
  );
}

const SECTION_COMPONENTS = {
  users: UsersTab,
  settings: SettingsTab,
  audit: AuditTab,
  storage: StorageTab,
};

const MOBILE_ADMIN_NAV = [
  { id: 'users', icon: Users },
  { id: 'settings', icon: Settings },
  { id: 'audit', icon: ScrollText },
  { id: 'storage', icon: HardDrive },
];

export default function AdminPage() {
  const { section = 'users' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const access = useAdminAccess();

  const allowedSections = useMemo(() => {
    const list = [];
    if (access.canUsers) list.push('users');
    if (access.canSettings) list.push('settings');
    if (access.canAudit) list.push('audit');
    if (access.canStorage) list.push('storage');
    return list;
  }, [access]);

  if (!access.canAccess) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertCircle size={40} className="text-ink-400" />
        <p className="text-sm text-ink-200">{t('admin.noAccess')}</p>
        <Button variant="secondary" onPress={() => navigate('/chat')}>{t('admin.backToChat')}</Button>
      </div>
    );
  }

  if (!allowedSections.includes(section)) {
    return <Navigate to={`/admin/${allowedSections[0]}`} replace />;
  }

  const SectionContent = SECTION_COMPONENTS[section] || UsersTab;
  const mobileNav = MOBILE_ADMIN_NAV.filter((n) => allowedSections.includes(n.id));

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-separator px-3 py-3 md:hidden">
        <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
          <ArrowLeft size={16} />
        </Button>
        <Shield size={16} className="text-accent" />
        <h2 className="text-sm font-semibold">{t('admin.title')}</h2>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-separator px-3 py-2 md:hidden">
        {mobileNav.map(({ id, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            onPress={() => navigate(`/admin/${id}`)}
            className={`flex h-auto shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              section === id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-default'
            }`}
          >
            <Icon size={13} />
            {t(`admin.sections.${id}`)}
          </Button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, x: 18, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: ENTRY_EASE }}
          className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6"
        >
          <div className="mb-5 hidden items-center gap-3 md:flex">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t('admin.title')}</h1>
              <p className="text-sm text-muted">{t(`admin.descriptions.${section}`)}</p>
            </div>
          </div>

          <div className="mb-4 hidden gap-2 md:flex">
            {mobileNav.map(({ id, icon: Icon }) => (
              <Button
                key={id}
                variant={section === id ? 'secondary' : 'ghost'}
                onPress={() => navigate(`/admin/${id}`)}
                className="gap-2"
              >
                <Icon size={14} />
                {t(`admin.sections.${id}`)}
              </Button>
            ))}
          </div>

          <SectionContent t={t} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
