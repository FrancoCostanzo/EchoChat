import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  InputGroup,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  Table,
  Tabs,
  toast,
} from '@heroui/react';
import {
  Shield,
  Users,
  Settings,
  ScrollText,
  HardDrive,
  Activity,
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/authStore';
import MonitoreoDashboard from '@/components/monitoring/MonitoreoDashboard';
import { useConfirm } from '@/components/ConfirmProvider';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/dates';

const USER_STATUSES = ['active', 'inactive', 'suspended'];
const USERS_PAGE_SIZE = 25;

// Chip color per user status (HeroUI Chip palette: accent/success/warning/danger/default).
const STATUS_CHIP_COLOR = {
  active: 'success',
  inactive: 'default',
  suspended: 'danger',
};

// Storage processing_status values per DB CHECK: pending/processing/ready/failed.
const STORAGE_STATUS_COLOR = {
  ready: 'success',
  processing: 'accent',
  pending: 'warning',
  failed: 'danger',
};

/* Reusable HeroUI Select — replaces raw <select> across the admin tabs. */
function AdminSelect({ value, onChange, ariaLabel, items, className = 'min-w-[170px]' }) {
  return (
    <Select
      aria-label={ariaLabel}
      value={value}
      onChange={(v) => onChange(String(v))}
      className={className}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map(({ id, label }) => (
            <ListBox.Item key={id} id={id} textValue={label}>
              {label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

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
      canMonitoring: isSuper || perms.some((p) => p.startsWith('admin.')),
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // LDAP import + registro
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [importing, setImporting] = useState(false);
  const [registrationAllowed, setRegistrationAllowed] = useState(true);
  const [togglingReg, setTogglingReg] = useState(false);
  // Reset de contraseña (solo usuarios locales)
  const [resetUser, setResetUser] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [resetting, setResetting] = useState(false);

  const buildParams = useCallback((offset) => {
    const params = { limit: USERS_PAGE_SIZE, offset };
    if (search.trim()) params.search = search.trim();
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
    if (deptFilter.trim()) params.department = deptFilter.trim();
    return params;
  }, [search, statusFilter, deptFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        adminApi.listUsers(buildParams(0)),
        adminApi.listRoles(),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setHasMore(usersRes.data.length === USERS_PAGE_SIZE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await adminApi.listUsers(buildParams(users.length));
      setUsers((prev) => [...prev, ...res.data]);
      setHasMore(res.data.length === USERS_PAGE_SIZE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, users.length]);

  useEffect(() => { load(); }, [load]);

  // Estado de LDAP y del toggle de auto-registro (una vez).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [statusRes, settingsRes] = await Promise.all([
          adminApi.getLdapStatus().catch(() => ({ data: { enabled: false } })),
          adminApi.getSettings().catch(() => ({ data: [] })),
        ]);
        if (!alive) return;
        setLdapEnabled(Boolean(statusRes.data?.enabled));
        const reg = (settingsRes.data || []).find((s) => s.key === 'allow_registration');
        if (reg) setRegistrationAllowed(reg.value !== false && reg.value !== 'false');
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, []);

  const handleToggleRegistration = async (next) => {
    setTogglingReg(true);
    setRegistrationAllowed(next); // optimista
    try {
      await adminApi.updateSetting('allow_registration', next);
    } catch (err) {
      setRegistrationAllowed(!next); // revertir
      toast.danger(err.message);
    } finally {
      setTogglingReg(false);
    }
  };

  const handleImportLdap = async () => {
    setImporting(true);
    try {
      const res = await adminApi.syncLdap();
      const { created = 0, updated = 0, failed = 0 } = res.data || {};
      toast.success(t('admin.users.importResult', { created, updated, failed }));
      await load();
    } catch (err) {
      toast.danger(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setResetting(true);
    try {
      await adminApi.resetUserPassword(resetUser.id, resetPw);
      toast.success(t('admin.users.passwordReset', { name: resetUser.display_name }));
      setResetUser(null);
      setResetPw('');
    } catch (err) {
      toast.danger(err.message);
    } finally {
      setResetting(false);
    }
  };

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
        <div className="relative min-w-[180px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-200" />
          <Input className="pl-9" placeholder={t('admin.users.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input
          className="min-w-[150px]"
          placeholder={t('admin.users.filterDept')}
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        />
        <AdminSelect
          ariaLabel={t('admin.users.allStatuses')}
          value={statusFilter}
          onChange={setStatusFilter}
          items={[
            { id: 'all', label: t('admin.users.allStatuses') },
            ...USER_STATUSES.map((s) => ({ id: s, label: t(`admin.users.status.${s}`) })),
          ]}
        />
        {ldapEnabled && (
          <Button variant="secondary" className="gap-2" isPending={importing} onPress={handleImportLdap}>
            <RefreshCw size={16} /> {t('admin.users.importLdap')}
          </Button>
        )}
        <Button className="gap-2" onPress={openCreate}>
          <Plus size={16} /> {t('admin.users.create')}
        </Button>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t('admin.users.allowRegistration')}</p>
          <p className="text-xs text-ink-200">{t('admin.users.allowRegistrationHint')}</p>
        </div>
        <Switch isSelected={registrationAllowed} isDisabled={togglingReg} onChange={handleToggleRegistration}>
          <Switch.Control><Switch.Thumb /></Switch.Control>
        </Switch>
      </Card>

      {error && <p className="text-sm text-echo-dnd">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={t('admin.sections.users')} className="min-w-[760px]">
              <Table.Header>
                <Table.Column isRowHeader>{t('admin.users.colUser')}</Table.Column>
                <Table.Column>{t('admin.users.colProvider')}</Table.Column>
                <Table.Column>{t('admin.users.colRoles')}</Table.Column>
                <Table.Column>{t('admin.users.colStatus')}</Table.Column>
                <Table.Column>{t('admin.users.colDept')}</Table.Column>
                <Table.Column className="text-end">{t('admin.users.colActions')}</Table.Column>
              </Table.Header>
              <Table.Body>
                {users.map((u) => {
                  const isLdap = u.auth_provider === 'ldap';
                  return (
                  <Table.Row key={u.id} id={u.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <UserAvatar user={u} size="xs" />
                        <div className="min-w-0">
                          <p className="font-medium">{u.display_name}</p>
                          <p className="truncate text-xs text-muted">{u.email || `@${u.username}`}</p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={isLdap ? 'accent' : 'default'}>
                        {isLdap ? t('admin.users.ldap') : t('admin.users.local')}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((r) => (
                          <Chip key={r} size="sm" variant="soft">{r}</Chip>
                        ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={STATUS_CHIP_COLOR[u.status] || 'default'}>
                        {t(`admin.users.status.${u.status}`, u.status)}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-muted">{u.department || '—'}</Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onPress={() => openEdit(u)}>{t('admin.users.edit')}</Button>
                        {!isLdap && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={t('admin.users.resetPassword')}
                            title={t('admin.users.resetPassword')}
                            onPress={() => { setResetUser(u); setResetPw(''); }}
                          >
                            <KeyRound size={14} />
                          </Button>
                        )}
                        <Button size="sm" variant="danger-soft" isIconOnly aria-label={t('admin.users.delete')} onPress={() => handleDelete(u)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      {!loading && hasMore && (
        <div className="flex justify-center">
          <Button variant="secondary" isPending={loadingMore} onPress={loadMore}>
            {t('admin.users.loadMore')}
          </Button>
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

      <Modal isOpen={!!resetUser} onOpenChange={(o) => { if (!o) setResetUser(null); }}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('admin.users.resetPasswordTitle')}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm text-ink-200">
                  {t('admin.users.resetPasswordFor', { name: resetUser?.display_name || '' })}
                </p>
                <Field label={t('admin.users.newPassword')}>
                  <Input
                    type="password"
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                  />
                </Field>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setResetUser(null)}>{t('common.cancel')}</Button>
                <Button isPending={resetting} isDisabled={resetPw.length < 8} onPress={handleResetPassword}>
                  {t('admin.users.resetPassword')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
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
                  <AdminSelect
                    ariaLabel={t('admin.users.statusLabel')}
                    className="w-full"
                    value={form.status || 'active'}
                    onChange={(v) => setForm({ ...form, status: v })}
                    items={USER_STATUSES.map((s) => ({ id: s, label: t(`admin.users.status.${s}`) }))}
                  />
                </Field>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-muted">{t('admin.users.roles')}</p>
                <div className="flex flex-wrap gap-3">
                  {roles.map((r) => (
                    <Checkbox
                      key={r.id}
                      isSelected={(form.role_names || []).includes(r.name)}
                      onChange={() => toggleRole(r.name)}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        {r.display_name || r.name}
                      </Checkbox.Content>
                    </Checkbox>
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
  const [success, setSuccess] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (action.trim()) params.action = action.trim();
      if (success && success !== 'all') params.success = success;
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
        <AdminSelect
          ariaLabel={t('admin.audit.allResults')}
          value={success}
          onChange={setSuccess}
          items={[
            { id: 'all', label: t('admin.audit.allResults') },
            { id: 'true', label: t('admin.audit.success') },
            { id: 'false', label: t('admin.audit.failed') },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={t('admin.sections.audit')} className="min-w-[720px]">
              <Table.Header>
                <Table.Column isRowHeader>{t('admin.audit.colTime')}</Table.Column>
                <Table.Column>{t('admin.audit.colActor')}</Table.Column>
                <Table.Column>{t('admin.audit.colAction')}</Table.Column>
                <Table.Column>{t('admin.audit.colResource')}</Table.Column>
                <Table.Column>{t('admin.audit.colResult')}</Table.Column>
              </Table.Header>
              <Table.Body>
                {entries.map((e) => (
                  <Table.Row key={e.id} id={e.id}>
                    <Table.Cell className="whitespace-nowrap text-xs text-muted">
                      {formatMessageTime(e.created_at)}
                    </Table.Cell>
                    <Table.Cell>{e.actor_display_name || e.actor_username || '—'}</Table.Cell>
                    <Table.Cell className="font-mono text-xs">{e.action}</Table.Cell>
                    <Table.Cell className="text-xs text-muted">
                      {e.resource_type}{e.resource_id ? ` / ${e.resource_id.slice(0, 8)}…` : ''}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={e.success ? 'success' : 'danger'}>
                        {e.success ? t('admin.audit.success') : t('admin.audit.failed')}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
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
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label={t('admin.storage.recentObjects')} className="min-w-[600px]">
              <Table.Header>
                <Table.Column isRowHeader>{t('admin.storage.colFile')}</Table.Column>
                <Table.Column>{t('admin.storage.colBucket')}</Table.Column>
                <Table.Column>{t('admin.storage.colSize')}</Table.Column>
                <Table.Column>{t('admin.storage.colStatus')}</Table.Column>
              </Table.Header>
              <Table.Body>
                {objects.map((o) => (
                  <Table.Row key={o.id} id={o.id}>
                    <Table.Cell>
                      <p className="truncate font-medium">{o.original_filename || o.object_key}</p>
                      <p className="text-muted">{o.uploader_display_name || '—'}</p>
                    </Table.Cell>
                    <Table.Cell className="font-mono">{o.bucket_name}</Table.Cell>
                    <Table.Cell>{formatBytes(o.file_size_bytes)}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={STORAGE_STATUS_COLOR[o.processing_status] || 'warning'}>
                        {o.processing_status}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
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

function MonitoringTab() {
  return <MonitoreoDashboard />;
}

const SECTION_COMPONENTS = {
  users: UsersTab,
  settings: SettingsTab,
  audit: AuditTab,
  storage: StorageTab,
  monitoring: MonitoringTab,
};

const MOBILE_ADMIN_NAV = [
  { id: 'users', icon: Users },
  { id: 'settings', icon: Settings },
  { id: 'audit', icon: ScrollText },
  { id: 'storage', icon: HardDrive },
  { id: 'monitoring', icon: Activity },
];

export default function AdminPage() {
  const { section } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const access = useAdminAccess();

  const allowedSections = useMemo(() => {
    const list = [];
    if (access.canUsers) list.push('users');
    if (access.canSettings) list.push('settings');
    if (access.canAudit) list.push('audit');
    if (access.canStorage) list.push('storage');
    if (access.canMonitoring) list.push('monitoring');
    return list;
  }, [access]);

  const [mountedSections, setMountedSections] = useState(() => new Set(section ? [section] : []));

  useEffect(() => {
    if (!section) return;
    setMountedSections((prev) => {
      if (prev.has(section)) return prev;
      const next = new Set(prev);
      next.add(section);
      return next;
    });
  }, [section]);

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

  const mobileNav = MOBILE_ADMIN_NAV.filter((n) => allowedSections.includes(n.id));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="echo-chat-bg relative z-10 flex shrink-0 items-center gap-2 border-b border-separator px-3 py-3 lg:hidden">
        <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
          <ArrowLeft size={16} />
        </Button>
        <Shield size={16} className="text-accent" />
        <h2 className="text-sm font-semibold">{t('admin.title')}</h2>
      </div>

      <div className="echo-chat-bg relative z-10 flex shrink-0 gap-1 overflow-x-auto border-b border-separator px-3 py-2 lg:hidden">
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6">
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

          {allowedSections.map((sec) => {
            if (!mountedSections.has(sec)) return null;
            const SectionComp = SECTION_COMPONENTS[sec];
            return (
              <div key={sec} className={sec !== section ? 'hidden' : undefined}>
                <SectionComp t={t} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
