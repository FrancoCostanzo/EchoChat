import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Input,
  InputGroup,
  Modal,
  Spinner,
} from '@heroui/react';
import {
  Megaphone,
  Plus,
  Users,
  Send,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { broadcastsApi, relationshipsApi } from '@/lib/endpoints';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/dates';

const STATUS_ICONS = {
  draft: Clock,
  scheduled: Calendar,
  sending: Clock,
  sent: CheckCircle2,
  failed: AlertCircle,
};

function StatusBadge({ status, t }) {
  const Icon = STATUS_ICONS[status] || Clock;
  const colors = {
    draft: 'text-ink-200 bg-ink-700',
    scheduled: 'text-amber-300 bg-amber-500/15',
    sending: 'text-accent bg-accent/15',
    sent: 'text-emerald-300 bg-emerald-500/15',
    failed: 'text-echo-dnd bg-echo-dnd/15',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[status] || colors.draft}`}>
      <Icon size={12} />
      {t(`broadcasts.status.${status}`, status)}
    </span>
  );
}

function BroadcastDetail({ listId, onBack, t }) {
  const [list, setList] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [department, setDepartment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, msgRes] = await Promise.all([
        broadcastsApi.getById(listId),
        broadcastsApi.getMessages(listId),
      ]);
      setList(listRes.data);
      setMessages(msgRes.data);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    load();
    relationshipsApi.getContacts().then((r) => setContacts(r.data || [])).catch(() => {});
  }, [load]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const payload = { body: body.trim() };
      if (scheduledAt) payload.scheduled_at = new Date(scheduledAt).toISOString();
      await broadcastsApi.sendMessage(listId, payload);
      setBody('');
      setScheduledAt('');
      await load();
    } finally {
      setSending(false);
    }
  };

  const handleRemoveRecipient = async (userId) => {
    await broadcastsApi.removeRecipient(listId, userId);
    await load();
  };

  const handleAddRecipients = async () => {
    const data = {};
    if (selectedIds.size) data.recipient_ids = [...selectedIds];
    if (department.trim()) data.department = department.trim();
    if (!data.recipient_ids?.length && !data.department) return;
    await broadcastsApi.addRecipients(listId, data);
    setAddOpen(false);
    setSelectedIds(new Set());
    setDepartment('');
    await load();
  };

  const toggleContact = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const existingIds = new Set((list?.recipients || []).map((r) => r.user_id));

  if (loading && !list) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onPress={onBack}>
          ← {t('broadcasts.back')}
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{list?.name}</h2>
          {list?.description && (
            <p className="truncate text-xs text-ink-200">{list.description}</p>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Recipients */}
        <Card className="flex flex-col gap-3 overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {t('broadcasts.recipients')} ({list?.recipients?.length || 0})
            </h3>
            <Button size="sm" variant="secondary" onPress={() => setAddOpen(true)}>
              <Plus size={14} />
            </Button>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {(list?.recipients || []).map((r) => (
              <li key={r.user_id} className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-2 py-1.5">
                <UserAvatar user={{ display_name: r.display_name || r.username }} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{r.display_name || r.username}</span>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={t('broadcasts.removeRecipient')}
                  onPress={() => handleRemoveRecipient(r.user_id)}
                >
                  <Trash2 size={14} className="text-ink-200" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Compose + history */}
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">{t('broadcasts.compose')}</h3>
            <InputGroup>
              <InputGroup.TextArea
                className="min-h-24"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('broadcasts.bodyPlaceholder')}
              />
            </InputGroup>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-ink-200">{t('broadcasts.scheduleOptional')}</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-foreground"
                />
              </div>
              <Button
                className="ml-auto gap-2"
                isPending={sending}
                onPress={handleSend}
                isDisabled={!body.trim()}
              >
                <Send size={16} />
                {scheduledAt ? t('broadcasts.schedule') : t('broadcasts.sendNow')}
              </Button>
            </div>
          </Card>

          <Card className="min-h-0 flex-1 overflow-hidden p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('broadcasts.history')}</h3>
            <ul className="max-h-full space-y-3 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-sm text-ink-200">{t('broadcasts.noMessages')}</p>
              )}
              {messages.map((msg) => (
                <li key={msg.id} className="rounded-lg border border-ink-700/60 bg-ink-800/40 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={msg.status} t={t} />
                    <span className="text-[11px] text-ink-200">
                      {formatMessageTime(msg.sent_at || msg.scheduled_at || msg.created_at)}
                    </span>
                    {msg.status === 'sent' && (
                      <span className="text-[11px] text-ink-200">
                        {t('broadcasts.delivered', {
                          delivered: msg.total_delivered || 0,
                          total: msg.total_recipients || 0,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal isOpen={addOpen} onOpenChange={setAddOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('broadcasts.addRecipients')}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-200">{t('broadcasts.department')}</label>
                  <Input
                    placeholder={t('broadcasts.departmentPlaceholder')}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {contacts
                .filter((c) => !existingIds.has(c.target_user_id))
                .map((c) => (
                  <label
                    key={c.target_user_id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-750"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.target_user_id)}
                      onChange={() => toggleContact(c.target_user_id)}
                      className="rounded"
                    />
                    <UserAvatar user={{ display_name: c.display_name || c.username }} size="xs" />
                    <span className="text-sm">{c.display_name || c.username}</span>
                  </label>
                ))}
            </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setAddOpen(false)}>{t('common.cancel')}</Button>
                <Button onPress={handleAddRecipients}>{t('broadcasts.add')}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export default function BroadcastsPage() {
  const { t } = useTranslation();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await broadcastsApi.list();
      setLists(res.data || []);
    } catch {
      setError(t('broadcasts.noAccess'));
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadLists();
    relationshipsApi.getContacts().then((r) => setContacts(r.data || [])).catch(() => {});
  }, [loadLists]);

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.size === 0) return;
    setCreating(true);
    try {
      const res = await broadcastsApi.create({
        name: name.trim(),
        description: description.trim() || null,
        recipient_ids: [...selectedIds],
      });
      setCreateOpen(false);
      setName('');
      setDescription('');
      setSelectedIds(new Set());
      await loadLists();
      setSelectedId(res.data.id);
    } finally {
      setCreating(false);
    }
  };

  const toggleContact = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (selectedId) {
    return (
      <BroadcastDetail
        listId={selectedId}
        onBack={() => { setSelectedId(null); loadLists(); }}
        t={t}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-accent">
            <Megaphone size={22} />
            <h1 className="echo-display text-xl font-bold">{t('broadcasts.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-ink-200">{t('broadcasts.subtitle')}</p>
        </div>
        <Button className="gap-2" onPress={() => setCreateOpen(true)} isDisabled={!!error}>
          <Plus size={16} />
          {t('broadcasts.create')}
        </Button>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertCircle size={32} className="text-ink-200" />
          <p className="text-sm text-ink-200">{error}</p>
        </Card>
      ) : lists.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Megaphone size={40} className="text-ink-400" />
          <p className="text-sm text-ink-200">{t('broadcasts.empty')}</p>
          <Button variant="secondary" onPress={() => setCreateOpen(true)}>
            {t('broadcasts.createFirst')}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <Card
              key={list.id}
              className="flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:border-accent/40"
              onClick={() => setSelectedId(list.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Megaphone size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{list.name}</h3>
                  {list.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-200">{list.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-ink-200">
                <Users size={12} />
                {t('broadcasts.listMeta')}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={createOpen} onOpenChange={setCreateOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('broadcasts.createTitle')}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-200">{t('broadcasts.name')}</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-200">{t('broadcasts.description')}</label>
                  <InputGroup>
                    <InputGroup.TextArea
                      className="min-h-16"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </InputGroup>
                </div>
            <div>
              <p className="mb-2 text-sm font-medium">{t('broadcasts.selectRecipients')}</p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-700 p-2">
                {contacts.map((c) => (
                  <label
                    key={c.target_user_id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-750"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.target_user_id)}
                      onChange={() => toggleContact(c.target_user_id)}
                      className="rounded"
                    />
                    <UserAvatar user={{ display_name: c.display_name || c.username }} size="xs" />
                    <span className="text-sm">{c.display_name || c.username}</span>
                  </label>
                ))}
              </div>
            </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
                <Button
                  isPending={creating}
                  onPress={handleCreate}
                  isDisabled={!name.trim() || selectedIds.size === 0}
                >
                  {t('broadcasts.create')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
