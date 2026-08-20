import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import type { DateValue } from '@internationalized/date';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  DateField,
  DateRangePicker,
  Input,
  InputGroup,
  Label,
  ListBox,
  Modal,
  RangeCalendar,
  Select,
  Spinner,
  Switch,
  Table,
  Tabs,
  TextField,
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
  ChevronLeft,
  ChevronRight,
  X,
  Plug,
  Network,
  CheckCircle2,
  Circle,
  ExternalLink,
  UserCog,
  Pencil,
  Camera,
  ShieldCheck,
  ShieldOff,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/authStore';
import MonitoreoDashboard from '@/components/monitoring/MonitoreoDashboard';
import { useConfirm } from '@/components/ConfirmProvider';
import UserAvatar from '@/components/UserAvatar';
import AvatarCropModal from '@/components/AvatarCropModal';
import { formatMessageTime } from '@/lib/dates';
import type {
  AdminUserResponse, RoleResponse, SettingResponse, AuditEntryResponse,
  StorageObjectAdminResponse, StorageStatsResponse, IntegrationsResponse, LdapSyncSummary,
  AdminCreateUserRequest, AdminUpdateUserRequest,
} from '@/types/admin';

type TFunc = ReturnType<typeof useTranslation>['t'];
type UserStatus = 'active' | 'inactive' | 'suspended';
/** Unión real de HeroUI v3 Chip `color` (ver notas de migración de otras páginas). */
type ChipColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const ENTRY_EASE = [0.34, 1.2, 0.64, 1] as const;

const USER_STATUSES: UserStatus[] = ['active', 'inactive', 'suspended'];
const USERS_PAGE_SIZE = 25;

// Chip color per user status (HeroUI Chip palette: accent/success/warning/danger/default).
const STATUS_CHIP_COLOR: Record<string, ChipColor> = {
  active: 'success',
  inactive: 'default',
  suspended: 'danger',
};

// Origen de la cuenta → color de chip. 'local' cae al default; el resto son
// proveedores externos de identidad (directorio / SSO / aprovisionamiento).
const PROVIDER_CHIP: Record<string, { color: ChipColor; key: string }> = {
  local: { color: 'default', key: 'local' },
  ldap: { color: 'accent', key: 'ldap' },
  oidc: { color: 'success', key: 'oidc' },
  saml: { color: 'success', key: 'saml' },
  scim: { color: 'warning', key: 'scim' },
};

// Storage processing_status values per DB CHECK: pending/processing/ready/failed.
const STORAGE_STATUS_COLOR: Record<string, ChipColor> = {
  ready: 'success',
  processing: 'accent',
  pending: 'warning',
  failed: 'danger',
};

/* Reusable HeroUI Select — fullWidth + secondary so it remains visible on dark panels/modals. */
function AdminSelect({
  value,
  onChange,
  ariaLabel,
  label,
  items,
  className = '',
  fullWidth = false,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  label?: string;
  items: { id: string; label: string }[];
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <Select
      aria-label={ariaLabel || label}
      value={value}
      onChange={(v) => onChange(String(v))}
      className={[fullWidth ? 'w-full' : 'min-w-[170px]', className].filter(Boolean).join(' ')}
      fullWidth={fullWidth}
      variant="secondary"
      placeholder={ariaLabel || label}
    >
      {label ? <Label>{label}</Label> : null}
      <Select.Trigger className={fullWidth ? 'w-full' : undefined}>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map(({ id, label: itemLabel }) => (
            <ListBox.Item key={id} id={id} textValue={itemLabel}>
              {itemLabel}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function AdminTextField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <TextField fullWidth className={className}>
      <Label>{label}</Label>
      <InputGroup fullWidth variant="secondary">
        {children}
      </InputGroup>
    </TextField>
  );
}

function formatBytes(bytes: number | string | null | undefined) {
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
      canIntegrations: isSuper || perms.includes('admin.users'),
      canSettings: isSuper || perms.includes('admin.settings'),
      canAudit: isSuper || perms.includes('admin.view_audit'),
      canStorage: isSuper || perms.includes('admin.storage'),
      canMonitoring: isSuper || perms.some((p) => p.startsWith('admin.')),
      canAccess: isSuper || perms.some((p) => p.startsWith('admin.')),
    };
  }, [user]);
}

function AdminCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
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

/** Form compartido entre crear/editar; los campos de `AdminUpdateUserRequest` son
 *  superset-compatibles con `AdminCreateUserRequest` salvo username/password. */
interface UserFormState {
  username?: string;
  password?: string;
  display_name?: string;
  email?: string;
  department?: string;
  job_title?: string;
  status?: UserStatus;
  role_names?: string[];
}

/* ── 7.1 Users ── */
function UsersTab({ t }: { t: TFunc }) {
  const confirm = useConfirm();
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserResponse | null>(null);
  const [form, setForm] = useState<UserFormState>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Toggle de auto-registro (la sincronización LDAP vive ahora en Integraciones)
  const [registrationAllowed, setRegistrationAllowed] = useState(true);
  const [togglingReg, setTogglingReg] = useState(false);
  // Reset de contraseña (solo usuarios locales)
  const [resetUser, setResetUser] = useState<AdminUserResponse | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetting, setResetting] = useState(false);

  const buildParams = useCallback((offset: number) => {
    const params: Record<string, string | number> = { limit: USERS_PAGE_SIZE, offset };
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
      setError(err instanceof Error ? err.message : '');
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
      setError(err instanceof Error ? err.message : '');
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, users.length]);

  useEffect(() => { load(); }, [load]);

  // Estado del toggle de auto-registro (una vez).
  useEffect(() => {
    let alive = true;
    adminApi.getSettings()
      .then((settingsRes) => {
        if (!alive) return;
        const reg = (settingsRes.data || []).find((s) => s.key === 'allow_registration');
        if (reg) setRegistrationAllowed(reg.value !== false && reg.value !== 'false');
      })
      .catch(() => { /* noop */ });
    return () => { alive = false; };
  }, []);

  const handleToggleRegistration = async (next: boolean) => {
    setTogglingReg(true);
    setRegistrationAllowed(next); // optimista
    try {
      await adminApi.updateSetting('allow_registration', next);
    } catch (err) {
      setRegistrationAllowed(!next); // revertir
      toast.danger(err instanceof Error ? err.message : '');
    } finally {
      setTogglingReg(false);
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
      toast.danger(err instanceof Error ? err.message : '');
    } finally {
      setResetting(false);
    }
  };

  const openCreate = () => {
    setForm({
      username: '',
      display_name: '',
      email: '',
      password: '',
      department: '',
      job_title: '',
      role_names: ['user'],
    });
    setCreateOpen(true);
  };

  const openEdit = (user: AdminUserResponse) => {
    setEditUser(user);
    setForm({
      display_name: user.display_name,
      email: user.email || '',
      department: user.department || '',
      job_title: user.job_title || '',
      status: (user.status as UserStatus) || 'active',
      role_names: user.roles || ['user'],
    });
  };

  const toggleRole = (name: string) => {
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
      await adminApi.createUser(form as AdminCreateUserRequest);
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setBusy(true);
    try {
      await adminApi.updateUser(editUser.id, form as AdminUpdateUserRequest);
      setEditUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (user: AdminUserResponse) => {
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
      const message = err instanceof Error ? err.message : '';
      setError(message);
      toast.danger(message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextField className="min-w-[200px] flex-1" aria-label={t('admin.users.search')}>
          <Label className="sr-only">{t('admin.users.search')}</Label>
          <InputGroup fullWidth variant="secondary">
            <InputGroup.Prefix>
              <Search size={15} className="text-ink-300" />
            </InputGroup.Prefix>
            <InputGroup.Input
              placeholder={t('admin.users.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
        </TextField>
        <AdminTextField label={t('admin.users.filterDept')} className="min-w-[160px] w-[180px]">
          <InputGroup.Input
            placeholder={t('admin.users.filterDept')}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          />
        </AdminTextField>
        <AdminSelect
          ariaLabel={t('admin.users.allStatuses')}
          label={t('admin.users.statusLabel')}
          value={statusFilter}
          onChange={setStatusFilter}
          items={[
            { id: 'all', label: t('admin.users.allStatuses') },
            ...USER_STATUSES.map((s) => ({ id: s, label: t(`admin.users.status.${s}`) })),
          ]}
        />
        <Button className="gap-2 shrink-0" onPress={openCreate}>
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
                  const provider = PROVIDER_CHIP[u.auth_provider] || PROVIDER_CHIP.local;
                  const isLocal = u.auth_provider === 'local' || !u.auth_provider;
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
                      <Chip size="sm" variant="soft" color={provider.color}>
                        {t(`admin.users.${provider.key}`, provider.key.toUpperCase())}
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
                      <Chip size="sm" variant="soft" color={STATUS_CHIP_COLOR[u.status || ''] || 'default'}>
                        {t(`admin.users.status.${u.status}`, u.status || '')}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-muted">{u.department || '—'}</Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onPress={() => openEdit(u)}>{t('admin.users.edit')}</Button>
                        {isLocal && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={t('admin.users.resetPassword')}
                            onPress={() => { setResetUser(u); setResetPw(''); }}
                          >
                            <KeyRound size={14} />
                          </Button>
                        )}
                        <Button size="sm" variant="danger" isIconOnly aria-label={t('admin.users.delete')} onPress={() => handleDelete(u)}>
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
        editUser={editUser}
        onAvatarUpdated={(updated) => {
          setEditUser(updated);
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
        }}
        t={t}
      />

      <Modal isOpen={!!resetUser} onOpenChange={(o) => { if (!o) setResetUser(null); }}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-accent/15 text-accent">
                  <KeyRound size={18} />
                </Modal.Icon>
                <Modal.Heading>{t('admin.users.resetPasswordTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <p className="text-sm text-ink-200">
                  {t('admin.users.resetPasswordFor', { name: resetUser?.display_name || '' })}
                </p>
                <AdminTextField label={t('admin.users.newPassword')}>
                  <InputGroup.Input
                    type="password"
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                  />
                </AdminTextField>
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

function UserFormModal({
  open,
  onClose,
  title,
  form,
  setForm,
  roles,
  toggleRole,
  onSave,
  busy,
  isCreate,
  editUser,
  onAvatarUpdated,
  t,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  form: UserFormState;
  setForm: (form: UserFormState) => void;
  roles: RoleResponse[];
  toggleRole: (name: string) => void;
  onSave: () => void;
  busy: boolean;
  isCreate?: boolean;
  editUser?: AdminUserResponse | null;
  onAvatarUpdated?: (updated: AdminUserResponse) => void;
  t: TFunc;
}) {
  const confirm = useConfirm();
  const update = (key: keyof UserFormState) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const cropObjectUrlRef = useRef<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [disabling2fa, setDisabling2fa] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('avatar.jpg');

  useEffect(() => {
    if (open && editUser) {
      setAvatarPreview(editUser.avatar_url || null);
      setTotpEnabled(!!editUser.totp_enabled);
    }
    if (!open) {
      setAvatarPreview(null);
      setTotpEnabled(false);
      setCropOpen(false);
      setCropImageSrc(null);
      if (cropObjectUrlRef.current) {
        URL.revokeObjectURL(cropObjectUrlRef.current);
        cropObjectUrlRef.current = null;
      }
    }
  }, [open, editUser]);

  useEffect(() => () => {
    if (cropObjectUrlRef.current) URL.revokeObjectURL(cropObjectUrlRef.current);
  }, []);

  const closeCropModal = () => {
    setCropOpen(false);
    setCropImageSrc(null);
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }
  };

  const handleAvatarPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editUser?.id) return;
    if (cropObjectUrlRef.current) URL.revokeObjectURL(cropObjectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    cropObjectUrlRef.current = objectUrl;
    setCropFileName(file.name || 'avatar.jpg');
    setCropImageSrc(objectUrl);
    setCropOpen(true);
  };

  const handleAvatarCropConfirm = async (file: File) => {
    if (!editUser?.id) return;
    setAvatarLoading(true);
    try {
      const { data } = await adminApi.uploadUserAvatar(editUser.id, file);
      setAvatarPreview(data.avatar_url || null);
      onAvatarUpdated?.(data);
      toast.success(t('admin.users.avatarUpdated'));
      closeCropModal();
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('admin.users.avatarError'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!editUser?.id || !avatarPreview) return;
    setAvatarLoading(true);
    try {
      const { data } = await adminApi.removeUserAvatar(editUser.id);
      setAvatarPreview(null);
      onAvatarUpdated?.({ ...data, avatar_url: undefined });
      toast.success(t('admin.users.avatarRemoved'));
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('admin.users.avatarError'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!editUser?.id || !totpEnabled) return;
    const ok = await confirm({
      status: 'danger',
      title: t('admin.users.disable2faTitle'),
      message: t('admin.users.disable2faConfirm', {
        name: editUser.display_name || editUser.username,
      }),
      confirmLabel: t('admin.users.disable2fa'),
    });
    if (!ok) return;

    setDisabling2fa(true);
    try {
      const { data } = await adminApi.disableUser2fa(editUser.id);
      setTotpEnabled(false);
      onAvatarUpdated?.({ ...data, totp_enabled: false });
      toast.success(t('admin.users.disable2faSuccess', {
        name: editUser.display_name || editUser.username,
      }));
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('admin.users.disable2faError'));
    } finally {
      setDisabling2fa(false);
    }
  };

  const avatarUser = editUser
    ? {
        ...editUser,
        display_name: form.display_name || editUser.display_name,
        avatar_url: avatarPreview,
      }
    : null;

  return (
    <>
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent/15 text-accent">
                {isCreate ? <Plus size={18} /> : <Pencil size={18} />}
              </Modal.Icon>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4">
              {!isCreate && avatarUser && (
                <div className="flex items-center gap-4 rounded-xl bg-ink-800/60 p-3 ring-1 ring-white/5">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
                    <UserAvatar user={avatarUser} size="lg" />
                    <label
                      htmlFor="admin-user-avatar-input"
                      className={[
                        'absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-full bg-black/50 transition-opacity',
                        avatarLoading ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus-within:opacity-100',
                      ].join(' ')}
                      aria-label={t('admin.users.changeAvatar')}
                    >
                      {avatarLoading ? (
                        <Spinner size="sm" />
                      ) : (
                        <Camera size={16} className="text-white" />
                      )}
                    </label>
                    <input
                      id="admin-user-avatar-input"
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={avatarLoading}
                      onChange={handleAvatarPick}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{avatarUser.display_name}</p>
                    <p className="truncate text-xs text-ink-200">@{editUser?.username}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto min-h-0 gap-1.5 px-0 text-xs font-medium text-accent"
                        isDisabled={avatarLoading}
                        onPress={() => avatarInputRef.current?.click()}
                      >
                        <Camera size={13} />
                        {t('admin.users.changeAvatar')}
                      </Button>
                      {avatarPreview && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto min-h-0 gap-1.5 px-0 text-xs font-medium text-echo-dnd"
                          isDisabled={avatarLoading}
                          onPress={handleRemoveAvatar}
                        >
                          <Trash2 size={13} />
                          {t('admin.users.removeAvatar')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!isCreate && editUser && (
                <div className="flex flex-col gap-2 rounded-xl bg-ink-800/60 p-3 ring-1 ring-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${totpEnabled ? 'bg-success/15 text-success' : 'bg-ink-700 text-ink-300'}`}>
                        {totpEnabled ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('admin.users.twoFactor')}</p>
                        <p className="text-xs text-ink-200">
                          {totpEnabled
                            ? t('admin.users.twoFactorEnabled')
                            : t('admin.users.twoFactorDisabled')}
                        </p>
                      </div>
                    </div>
                    {totpEnabled && (
                      <Button
                        size="sm"
                        variant="danger-soft"
                        className="shrink-0 gap-1.5"
                        isPending={disabling2fa}
                        onPress={handleDisable2fa}
                      >
                        <ShieldOff size={14} />
                        {t('admin.users.disable2fa')}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {isCreate && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminTextField label={t('admin.users.username')}>
                    <InputGroup.Input
                      value={form.username || ''}
                      onChange={update('username')}
                      autoComplete="off"
                      autoFocus
                    />
                  </AdminTextField>
                  <AdminTextField label={t('admin.users.password')}>
                    <InputGroup.Input
                      type="password"
                      value={form.password || ''}
                      onChange={update('password')}
                      autoComplete="new-password"
                    />
                  </AdminTextField>
                </div>
              )}

              <AdminTextField label={t('admin.users.displayName')}>
                <InputGroup.Input
                  value={form.display_name || ''}
                  onChange={update('display_name')}
                  autoFocus={!isCreate}
                />
              </AdminTextField>

              <AdminTextField label={t('admin.users.email')}>
                <InputGroup.Input
                  type="email"
                  value={form.email || ''}
                  onChange={update('email')}
                  autoComplete="off"
                />
              </AdminTextField>

              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextField label={t('admin.users.department')}>
                  <InputGroup.Input
                    value={form.department || ''}
                    onChange={update('department')}
                  />
                </AdminTextField>
                <AdminTextField label={t('settings.jobTitle')}>
                  <InputGroup.Input
                    value={form.job_title || ''}
                    onChange={update('job_title')}
                  />
                </AdminTextField>
              </div>

              {!isCreate && (
                <AdminSelect
                  fullWidth
                  label={t('admin.users.statusLabel')}
                  ariaLabel={t('admin.users.statusLabel')}
                  value={form.status || 'active'}
                  onChange={(v) => setForm({ ...form, status: v as UserStatus })}
                  items={USER_STATUSES.map((s) => ({
                    id: s,
                    label: t(`admin.users.status.${s}`),
                  }))}
                />
              )}

              <div className="flex flex-col gap-2">
                <Label>{t('admin.users.roles')}</Label>
                <div className="flex flex-wrap gap-2 rounded-xl bg-ink-800/60 p-3 ring-1 ring-white/5">
                  {roles.length === 0 ? (
                    <p className="text-xs text-ink-300">{t('common.loading')}</p>
                  ) : (
                    roles.map((r) => {
                      const selected = (form.role_names || []).includes(r.name);
                      return (
                        <Checkbox
                          key={r.id}
                          isSelected={selected}
                          onChange={() => toggleRole(r.name)}
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <span className="text-sm">{r.display_name || r.name}</span>
                          </Checkbox.Content>
                        </Checkbox>
                      );
                    })
                  )}
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

    <AvatarCropModal
      isOpen={cropOpen}
      imageSrc={cropImageSrc}
      fileName={cropFileName}
      onClose={closeCropModal}
      onConfirm={handleAvatarCropConfirm}
      loading={avatarLoading}
    />
    </>
  );
}

/* ── 7.2 Settings ── */
function SettingsTab({ t }: { t: TFunc }) {
  const [settings, setSettings] = useState<SettingResponse[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SettingResponse | null>(null);
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
    const cats = [...new Set(settings.map((s) => s.category).filter((c): c is string => Boolean(c)))];
    return ['all', ...cats.sort()];
  }, [settings]);

  const filtered = category === 'all' ? settings : settings.filter((s) => s.category === category);

  const openEdit = (setting: SettingResponse) => {
    setEditing(setting);
    setValueText(typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value, null, 2));
  };

  const handleSave = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      let parsed: unknown = valueText;
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
      <Tabs
        selectedKey={category}
        onSelectionChange={(key) => setCategory(String(key))}
        className="w-full"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('admin.settings.categories')} className="w-full">
            {categories.map((cat) => (
              <Tabs.Tab key={cat} id={cat}>
                {cat === 'all' ? t('admin.settings.all') : cat}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
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
const SEVERITY_COLOR: Record<string, ChipColor> = { info: 'default', warning: 'warning', critical: 'danger' };
// 'primary'/'secondary' no existen en la paleta real de Chip (ver ChipColor) — mapeados a accent/default.
const CATEGORY_COLOR: Record<string, ChipColor> = { auth: 'accent', admin: 'default', content: 'default', system: 'accent', security: 'warning' };

function AuditTab({ t }: { t: TFunc }) {
  const [entries, setEntries] = useState<AuditEntryResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('50');
  const [sortDescriptor, setSortDescriptor] = useState<{ column: string; direction: 'ascending' | 'descending' }>({ column: 'created_at', direction: 'descending' });
  const [filters, setFilters] = useState({
    action: '', category: 'all', severity: 'all', success: 'all', from: '', to: '',
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: DateValue; end: DateValue } | null>(null);

  const limit = parseInt(pageSize, 10);
  const offset = (page - 1) * limit;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const expandedEntry = expanded ? entries.find((e) => String(e.id) === expanded) : null;

  const updateFilter = useCallback((key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleDateRangeChange = useCallback((range: { start: DateValue; end: DateValue } | null) => {
    setDateRange(range);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      from: range?.start?.toString() ?? '',
      to: range?.end?.toString() ?? '',
    }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        limit,
        offset,
        sort_column: sortDescriptor.column,
        sort_dir: sortDescriptor.direction,
      };
      if (filters.action.trim()) params.action = filters.action.trim();
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.severity !== 'all') params.severity = filters.severity;
      if (filters.success !== 'all') params.success = filters.success;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = `${filters.to}T23:59:59Z`;
      const res = await adminApi.getAuditLog(params);
      setEntries(res.data.entries ?? []);
      setTotal(res.data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [filters, limit, offset, sortDescriptor]);

  useEffect(() => { load(); }, [load]);

  const getActionLabel = (action: string) => {
    const key = `admin.audit.actions.${action.replace(/\./g, '_').replace(/-/g, '_')}`;
    const label = t(key);
    return label === key ? null : label;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Input
          placeholder={t('admin.audit.filterAction')}
          value={filters.action}
          onChange={(e) => updateFilter('action', e.target.value)}
          className="lg:col-span-1"
        />
        <AdminSelect
          ariaLabel={t('admin.audit.filterCategory')}
          value={filters.category}
          onChange={(v) => updateFilter('category', v)}
          items={[
            { id: 'all', label: t('admin.audit.allCategories') },
            { id: 'auth', label: t('admin.audit.categories.auth') },
            { id: 'admin', label: t('admin.audit.categories.admin') },
            { id: 'content', label: t('admin.audit.categories.content') },
            { id: 'system', label: t('admin.audit.categories.system') },
            { id: 'security', label: t('admin.audit.categories.security') },
          ]}
        />
        <AdminSelect
          ariaLabel={t('admin.audit.filterSeverity')}
          value={filters.severity}
          onChange={(v) => updateFilter('severity', v)}
          items={[
            { id: 'all', label: t('admin.audit.allSeverities') },
            { id: 'info', label: t('admin.audit.severities.info') },
            { id: 'warning', label: t('admin.audit.severities.warning') },
            { id: 'critical', label: t('admin.audit.severities.critical') },
          ]}
        />
        <AdminSelect
          ariaLabel={t('admin.audit.allResults')}
          value={filters.success}
          onChange={(v) => updateFilter('success', v)}
          items={[
            { id: 'all', label: t('admin.audit.allResults') },
            { id: 'true', label: t('admin.audit.success') },
            { id: 'false', label: t('admin.audit.failed') },
          ]}
        />
        <DateRangePicker
          value={dateRange}
          onChange={handleDateRangeChange}
          granularity="day"
          aria-label={t('admin.audit.dateRange')}
          className="sm:col-span-2 lg:col-span-2"
        >
          <DateField.Group fullWidth>
            <DateField.Input slot="start">
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
            <DateRangePicker.RangeSeparator />
            <DateField.Input slot="end">
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
            <DateField.Suffix>
              <DateRangePicker.Trigger>
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DateRangePicker.Popover>
            <RangeCalendar aria-label={t('admin.audit.dateRange')}>
              <RangeCalendar.Header>
                <RangeCalendar.YearPickerTrigger>
                  <RangeCalendar.YearPickerTriggerHeading />
                  <RangeCalendar.YearPickerTriggerIndicator />
                </RangeCalendar.YearPickerTrigger>
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>
                  {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
              <RangeCalendar.YearPickerGrid>
                <RangeCalendar.YearPickerGridBody>
                  {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                </RangeCalendar.YearPickerGridBody>
              </RangeCalendar.YearPickerGrid>
            </RangeCalendar>
          </DateRangePicker.Popover>
        </DateRangePicker>
      </div>

      {/* Toolbar: total + page size */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">{total} {t('admin.audit.totalResults')}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted hidden sm:inline">{t('admin.audit.rowsPerPage')}</span>
          <AdminSelect
            ariaLabel={t('admin.audit.rowsPerPage')}
            className="min-w-[80px]"
            value={pageSize}
            onChange={(v) => { setPageSize(String(v)); setPage(1); }}
            items={[
              { id: '25', label: '25' },
              { id: '50', label: '50' },
              { id: '100', label: '100' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <>
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label={t('admin.sections.audit')}
                className="min-w-[900px]"
                sortDescriptor={sortDescriptor}
                onSortChange={(descriptor) => { setSortDescriptor({ column: String(descriptor.column), direction: descriptor.direction }); setPage(1); }}
                onRowAction={(key) => setExpanded((prev) => (prev === String(key) ? null : String(key)))}
              >
                <Table.Header>
                  <Table.Column id="created_at" isRowHeader allowsSorting>{t('admin.audit.colTime')}</Table.Column>
                  <Table.Column id="actor" allowsSorting>{t('admin.audit.colActor')}</Table.Column>
                  <Table.Column id="action" allowsSorting>{t('admin.audit.colAction')}</Table.Column>
                  <Table.Column id="severity" allowsSorting>{t('admin.audit.colSeverity')}</Table.Column>
                  <Table.Column id="category" allowsSorting>{t('admin.audit.colCategory')}</Table.Column>
                  <Table.Column id="resource">{t('admin.audit.colResource')}</Table.Column>
                  <Table.Column id="ip">{t('admin.audit.colIp')}</Table.Column>
                  <Table.Column id="success" allowsSorting>{t('admin.audit.colResult')}</Table.Column>
                </Table.Header>
                <Table.Body>
                  {entries.map((e) => (
                    <Table.Row
                      key={String(e.id)}
                      id={String(e.id)}
                      className={`cursor-pointer transition-colors ${String(e.id) === expanded ? 'bg-default-50' : ''}`}
                    >
                      <Table.Cell className="whitespace-nowrap text-xs text-muted">
                        {formatMessageTime(e.created_at)}
                      </Table.Cell>
                      <Table.Cell className="text-sm">
                        {e.actor_display_name || e.actor_username || '—'}
                      </Table.Cell>
                      <Table.Cell>
                        {getActionLabel(e.action) ? (
                          <div>
                            <span className="text-sm font-medium">{getActionLabel(e.action)}</span>
                            <span className="block font-mono text-[10px] text-muted">{e.action}</span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs">{e.action}</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={SEVERITY_COLOR[e.severity] || 'default'}>
                          {t(`admin.audit.severities.${e.severity}`) || e.severity || 'info'}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={CATEGORY_COLOR[e.category] || 'default'}>
                          {t(`admin.audit.categories.${e.category}`) || e.category || '—'}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-xs text-muted">
                        {e.resource_type || '—'}{e.resource_id ? ` / ${e.resource_id.slice(0, 8)}…` : ''}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-xs text-muted">
                        {e.ip_address || '—'}
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

          {/* Detail panel */}
          {expandedEntry && (
            <Card className="border border-default-200">
              <Card.Header className="flex items-center justify-between">
                <span className="font-semibold text-sm">{t('admin.audit.detailTitle')}</span>
                <Button size="sm" variant="ghost" isIconOnly onPress={() => setExpanded(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </Card.Header>
              <hr className="border-divider" />
              <Card.Content className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted mb-3">{t('admin.audit.detail.info')}</p>
                  <dl className="space-y-2">
                    <div className="flex gap-3">
                      <dt className="text-muted min-w-[90px] text-xs">ID</dt>
                      <dd className="font-mono text-xs">{expandedEntry.id}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="text-muted min-w-[90px] text-xs">IP</dt>
                      <dd className="font-mono text-xs">{expandedEntry.ip_address || '—'}</dd>
                    </div>
                    {expandedEntry.duration_ms != null && (
                      <div className="flex gap-3">
                        <dt className="text-muted min-w-[90px] text-xs">Duración</dt>
                        <dd className="text-xs">{expandedEntry.duration_ms} ms</dd>
                      </div>
                    )}
                    {expandedEntry.error_message && (
                      <div className="flex gap-3">
                        <dt className="text-muted min-w-[90px] text-xs">Error</dt>
                        <dd className="text-xs text-danger">{expandedEntry.error_message}</dd>
                      </div>
                    )}
                    {expandedEntry.metadata && (
                      <div className="flex gap-3">
                        <dt className="text-muted min-w-[90px] text-xs">Metadata</dt>
                        <dd className="font-mono text-xs break-all">{JSON.stringify(expandedEntry.metadata)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                {Boolean(expandedEntry.data_before || expandedEntry.data_after) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted mb-2">{t('admin.audit.detail.before')}</p>
                      <pre className="text-xs bg-default-50 dark:bg-default-100/10 rounded-lg p-3 overflow-auto max-h-36 font-mono">
                        {expandedEntry.data_before ? JSON.stringify(expandedEntry.data_before, null, 2) : '—'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted mb-2">{t('admin.audit.detail.after')}</p>
                      <pre className="text-xs bg-default-50 dark:bg-default-100/10 rounded-lg p-3 overflow-auto max-h-36 font-mono">
                        {expandedEntry.data_after ? JSON.stringify(expandedEntry.data_after, null, 2) : '—'}
                      </pre>
                    </div>
                  </div>
                )}
              </Card.Content>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                isDisabled={page <= 1}
                onPress={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted px-2">{page} / {totalPages}</span>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                isDisabled={page >= totalPages}
                onPress={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── 7.4 Storage ── */
function StorageTab({ t }: { t: TFunc }) {
  const [stats, setStats] = useState<StorageStatsResponse | null>(null);
  const [objects, setObjects] = useState<StorageObjectAdminResponse[]>([]);
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

  const summary: Partial<StorageStatsResponse['summary']> = stats?.summary || {};

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('admin.storage.totalObjects')} value={summary.total_objects ?? 0} />
        <StatCard label={t('admin.storage.totalSize')} value={formatBytes(summary.total_bytes)} />
        <StatCard label={t('admin.storage.pending')} value={summary.pending_processing ?? 0} />
        <StatCard label={t('admin.storage.failed')} value={summary.failed_processing ?? 0} />
      </div>

      {stats?.by_bucket && stats.by_bucket.length > 0 && (
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

function StatCard({ label, value }: { label: string; value: ReactNode }) {
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

/* ── Integraciones (LDAP + SSO) ── */
// Documentación pública de integraciones (sitio de docs desplegado).
const INTEGRATIONS_DOCS_URL = 'https://echochat.netlify.app/docs/admin/integraciones/';

function StatusPill({ active, activeLabel, inactiveLabel }: { active?: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <Chip size="sm" variant="soft" color={active ? 'success' : 'default'} className="gap-1">
      {active ? <CheckCircle2 size={12} /> : <Circle size={12} />}
      {active ? activeLabel : inactiveLabel}
    </Chip>
  );
}

function IntegrationRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2 text-sm font-medium">{children}</div>
    </div>
  );
}

function OnOffChip({ on, t }: { on?: boolean; t: TFunc }) {
  return (
    <Chip size="sm" variant="soft" color={on ? 'accent' : 'default'}>
      {on ? t('admin.integrations.ldap.on') : t('admin.integrations.ldap.off')}
    </Chip>
  );
}

function IntegrationCard({
  icon: Icon,
  title,
  subtitle,
  statusPill,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  statusPill: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="echo-panel-solid flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {statusPill}
          </div>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function IntegrationsTab({ t }: { t: TFunc }) {
  const { canUsers } = useAdminAccess();
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<LdapSyncSummary | null>(null);

  useEffect(() => {
    let alive = true;
    adminApi.getIntegrations()
      .then((res) => { if (alive) setData(res.data); })
      .catch((err) => { if (alive) toast.danger(err instanceof Error ? err.message : ''); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await adminApi.syncLdap();
      setSyncResult(res.data);
      const { created = 0, updated = 0, disabled = 0, failed = 0 } = res.data || {};
      toast.success(t('admin.integrations.ldap.syncResult', { created, updated, disabled, failed }));
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : '');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  const ldap: Partial<IntegrationsResponse['ldap']> = data?.ldap || {};
  const sso: Partial<IntegrationsResponse['sso']> = data?.sso || {};
  const scim: Partial<IntegrationsResponse['scim']> = data?.scim || {};

  return (
    <div className="flex w-full flex-col gap-4">
      <IntegrationCard
        icon={Network}
        title={t('admin.integrations.ldap.title')}
        subtitle={t('admin.integrations.ldap.subtitle')}
        statusPill={
          <StatusPill
            active={ldap.enabled}
            activeLabel={t('admin.integrations.ldap.connected')}
            inactiveLabel={t('admin.integrations.ldap.disabled')}
          />
        }
      >
        {ldap.enabled ? (
          <>
            <div className="rounded-xl bg-white/[0.03] px-4">
              <IntegrationRow label={t('admin.integrations.ldap.baseDn')}>
                <code className="max-w-[240px] truncate text-xs text-muted">{ldap.base_dn || '—'}</code>
              </IntegrationRow>
              <IntegrationRow label={t('admin.integrations.ldap.autoSync')}>
                {ldap.sync_enabled && <code className="text-xs text-muted">{ldap.sync_cron}</code>}
                <OnOffChip on={ldap.sync_enabled} t={t} />
              </IntegrationRow>
              <IntegrationRow label={t('admin.integrations.ldap.deprovision')}>
                <OnOffChip on={ldap.deprovision} t={t} />
              </IntegrationRow>
              <IntegrationRow label={t('admin.integrations.ldap.syncRoles')}>
                <OnOffChip on={ldap.sync_roles} t={t} />
              </IntegrationRow>
            </div>
            {canUsers && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" className="gap-2" isPending={syncing} onPress={handleSync}>
                  <RefreshCw size={16} /> {t('admin.integrations.ldap.syncNow')}
                </Button>
                {syncResult && (
                  <p className="text-xs text-muted">
                    {t('admin.integrations.ldap.syncResult', {
                      created: syncResult.created || 0,
                      updated: syncResult.updated || 0,
                      disabled: syncResult.disabled || 0,
                      failed: syncResult.failed || 0,
                    })}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{t('admin.integrations.ldap.disabledHint')}</p>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={KeyRound}
        title={t('admin.integrations.sso.title')}
        subtitle={t('admin.integrations.sso.subtitle')}
        statusPill={
          <StatusPill
            active={sso.enabled}
            activeLabel={t('admin.integrations.sso.enabled')}
            inactiveLabel={t('admin.integrations.sso.disabled')}
          />
        }
      >
        {sso.enabled ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('admin.integrations.sso.providers')}
            </p>
            {sso.providers?.length ? (
              <div className="flex flex-wrap gap-2">
                {sso.providers.map((p) => (
                  <Chip key={p.name} variant="soft" color="accent" className="gap-1.5">
                    <Plug size={13} /> {p.label}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t('admin.integrations.sso.noProviders')}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">{t('admin.integrations.sso.disabledHint')}</p>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={UserCog}
        title={t('admin.integrations.scim.title')}
        subtitle={t('admin.integrations.scim.subtitle')}
        statusPill={
          <StatusPill
            active={scim.enabled}
            activeLabel={t('admin.integrations.scim.enabled')}
            inactiveLabel={t('admin.integrations.scim.disabled')}
          />
        }
      >
        {scim.enabled ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('admin.integrations.scim.endpoint')}
            </p>
            <code className="w-fit max-w-full truncate rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs text-muted">
              {`${window.location.origin}/scim/v2`}
            </code>
          </div>
        ) : (
          <p className="text-sm text-muted">{t('admin.integrations.scim.disabledHint')}</p>
        )}
      </IntegrationCard>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Settings size={13} /> {t('admin.integrations.docsHint')}
        </span>
        <a
          href={INTEGRATIONS_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
        >
          {t('admin.integrations.docsLink')} <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

const SECTION_COMPONENTS: Record<string, (props: { t: TFunc }) => ReactNode> = {
  users: UsersTab,
  integrations: IntegrationsTab,
  settings: SettingsTab,
  audit: AuditTab,
  storage: StorageTab,
  monitoring: MonitoringTab,
};

const MOBILE_ADMIN_NAV: { id: string; icon: LucideIcon }[] = [
  { id: 'users', icon: Users },
  { id: 'integrations', icon: Plug },
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
    const list: string[] = [];
    if (access.canUsers) list.push('users');
    if (access.canIntegrations) list.push('integrations');
    if (access.canSettings) list.push('settings');
    if (access.canAudit) list.push('audit');
    if (access.canStorage) list.push('storage');
    if (access.canMonitoring) list.push('monitoring');
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

  if (!section || !allowedSections.includes(section)) {
    return <Navigate to={`/admin/${allowedSections[0]}`} replace />;
  }

  const mobileNav = MOBILE_ADMIN_NAV.filter((n) => allowedSections.includes(n.id));
  const SectionComp = SECTION_COMPONENTS[section];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Mobile header */}
      <div className="echo-chat-bg relative z-10 flex shrink-0 items-center gap-2 border-b border-separator px-3 py-3 lg:hidden">
        <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
          <ArrowLeft size={16} />
        </Button>
        <Shield size={16} className="text-accent" />
        <h2 className="text-sm font-semibold">{t('admin.title')}</h2>
      </div>

      {/* Mobile tab nav */}
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
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, x: 18, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: ENTRY_EASE }}
            className="w-full px-4 py-4 md:px-6 md:py-6"
          >
            {/* Desktop header */}
            <div className="mb-5 hidden lg:block">
              <h1 className="text-xl font-bold text-foreground">{t(`admin.sections.${section}`)}</h1>
              <p className="mt-0.5 text-sm text-muted">{t(`admin.descriptions.${section}`)}</p>
            </div>

            {SectionComp && <SectionComp t={t} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
