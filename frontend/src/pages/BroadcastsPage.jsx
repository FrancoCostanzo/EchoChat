import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  Input,
  InputGroup,
  Label,
  Spinner,
  TextField,
  TimeField,
} from '@heroui/react';
import { getLocalTimeZone } from '@internationalized/date';
import {
  Megaphone,
  Plus,
  Users,
  Send,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar as CalendarIcon,
  Search,
  ArrowLeft,
  X,
  Building2,
  Check,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { broadcastsApi, usersApi } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/authStore';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime, formatFullTime } from '@/lib/dates';
import { listItemEntry, PANEL_FADE } from '@/lib/motion';

const STATUS_ICONS = {
  draft: Clock,
  scheduled: CalendarIcon,
  sending: Clock,
  sent: CheckCircle2,
  failed: AlertCircle,
};

const PAGE_SIZE = 20;

/** Normalize contact / search / recipient rows into a shape UserAvatar understands. */
function toPickerUser(u) {
  return {
    id: u.id ?? u.target_user_id ?? u.user_id,
    display_name: u.display_name || u.username,
    username: u.username,
    avatar_url: u.avatar_url,
    department: u.department,
  };
}

/**
 * Browse all users (paginated) by default; typing switches to live search.
 * Mirrors the /chat/new picker so the list isn’t empty until you search.
 */
function useUserPicker() {
  const selfId = useAuthStore((s) => s.user?.id);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = useCallback(async (currentOffset, replace = false) => {
    setPageLoading(true);
    try {
      const { data } = await usersApi.search('', PAGE_SIZE, currentOffset);
      const page = (data || [])
        .filter((u) => u.id !== selfId)
        .map(toPickerUser);
      setResults((prev) => (replace ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE_SIZE);
      setOffset(currentOffset + page.length);
    } catch {
      setHasMore(false);
    } finally {
      setPageLoading(false);
    }
  }, [selfId]);

  // Initial browse
  useEffect(() => {
    loadPage(0, true);
  }, [loadPage]);

  // Debounced search, or restore browse when query cleared
  useEffect(() => {
    if (query.trim().length === 0) {
      setOffset(0);
      setHasMore(true);
      loadPage(0, true);
      return undefined;
    }
    if (query.trim().length < 2) {
      return undefined;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(query.trim(), 40, 0);
        setResults(
          (data || []).filter((u) => u.id !== selfId).map(toPickerUser),
        );
        setHasMore(false);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, selfId, loadPage]);

  const reset = useCallback(() => {
    setQuery('');
    setOffset(0);
    setHasMore(true);
    loadPage(0, true);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || pageLoading || query.trim()) return;
    loadPage(offset, false);
  }, [hasMore, pageLoading, query, offset, loadPage]);

  return {
    query,
    setQuery,
    results,
    searching: searching || (pageLoading && results.length === 0),
    pageLoading,
    hasMore: hasMore && !query.trim(),
    loadMore,
    reset,
  };
}

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

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="shrink-0 text-ink-300">{label}</span>
      <span className="truncate text-right text-ink-100">{value}</span>
    </div>
  );
}

function DeliveryStats({ msg, t }) {
  const total = msg.total_recipients || 0;
  const sent = msg.total_sent ?? total;
  const received = msg.total_delivered || 0;
  const read = msg.total_read || 0;
  const failed = Math.max(0, total - sent);
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;

  if (!total && msg.status !== 'sent' && msg.status !== 'failed' && msg.status !== 'sending') {
    return null;
  }

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1 text-ink-200">
          <Users size={11} />
          {t('broadcasts.stats.recipients', { count: total })}
        </span>
        <span className="inline-flex items-center gap-1 text-ink-100">
          <CheckCircle2 size={11} />
          {t('broadcasts.stats.sent', { count: sent })}
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-300/90">
          <CheckCircle2 size={11} />
          {t('broadcasts.stats.received', { count: received })}
        </span>
        {read > 0 && (
          <span className="inline-flex items-center gap-1 text-accent">
            <Eye size={11} />
            {t('broadcasts.stats.read', { count: read })}
          </span>
        )}
        {failed > 0 && (
          <span className="inline-flex items-center gap-1 text-echo-dnd">
            <AlertCircle size={11} />
            {t('broadcasts.stats.failed', { count: failed })}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
            title={`${pct}%`}
          />
        </div>
      )}
    </div>
  );
}

function HistoryMessageCard({ msg, listId, t }) {
  const [expanded, setExpanded] = useState(false);
  const [deliveries, setDeliveries] = useState(null);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const canExpand = ['sent', 'failed', 'sending'].includes(msg.status);
  const sender = {
    display_name: msg.sender_display_name || msg.sender_username,
    username: msg.sender_username,
    avatar_url: msg.sender_avatar_url,
  };

  const toggleExpand = async () => {
    if (!canExpand) return;
    const next = !expanded;
    setExpanded(next);
    if (next && deliveries === null) {
      setLoadingDeliveries(true);
      try {
        const { data } = await broadcastsApi.getDeliveries(listId, msg.id);
        setDeliveries(data || []);
      } catch {
        setDeliveries([]);
      } finally {
        setLoadingDeliveries(false);
      }
    }
  };

  return (
    <li className="rounded-xl border border-ink-700/50 bg-ink-800/40 p-3.5">
      <div className="flex items-start gap-2.5">
        <UserAvatar user={sender} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={msg.status} t={t} />
            {msg.type && msg.type !== 'text' && (
              <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-200">
                {msg.type}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] font-medium text-ink-100">
            {sender.display_name || t('broadcasts.unknownSender')}
          </p>
        </div>
        {canExpand && (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={toggleExpand}
            aria-expanded={expanded}
            aria-label={expanded ? t('broadcasts.hideDeliveries') : t('broadcasts.showDeliveries')}
            className="shrink-0"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </Button>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {msg.body}
      </p>

      <div className="mt-3 space-y-1 rounded-lg bg-ink-900/50 px-2.5 py-2">
        <MetaRow label={t('broadcasts.meta.created')} value={formatFullTime(msg.created_at)} />
        <MetaRow label={t('broadcasts.meta.scheduled')} value={formatFullTime(msg.scheduled_at)} />
        <MetaRow label={t('broadcasts.meta.sent')} value={formatFullTime(msg.sent_at)} />
        {!msg.sent_at && !msg.scheduled_at && (
          <MetaRow label={t('broadcasts.meta.time')} value={formatMessageTime(msg.created_at)} />
        )}
      </div>

      <DeliveryStats msg={msg} t={t} />

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-ink-700/60 pt-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-300">
                {t('broadcasts.deliveries')}
              </p>
              {loadingDeliveries ? (
                <div className="flex justify-center py-3"><Spinner size="sm" /></div>
              ) : !deliveries?.length ? (
                <p className="py-2 text-center text-[12px] text-ink-300">
                  {t('broadcasts.noDeliveries')}
                </p>
              ) : (
                <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                  {deliveries.map((d) => {
                    const user = toPickerUser(d);
                    let statusLine = t('broadcasts.notSent');
                    if (d.read_at) {
                      statusLine = t('broadcasts.readAt', { time: formatFullTime(d.read_at) });
                    } else if (d.received_at) {
                      statusLine = t('broadcasts.receivedAt', { time: formatFullTime(d.received_at) });
                    } else if (d.sent_to_chat_at) {
                      statusLine = t('broadcasts.sentToChatAt', { time: formatFullTime(d.sent_to_chat_at) });
                    }
                    return (
                      <li
                        key={d.user_id}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                      >
                        <UserAvatar user={user} size="xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium">
                            {user.display_name}
                          </p>
                          <p className="truncate text-[10px] text-ink-300">
                            {statusLine}
                          </p>
                        </div>
                        {d.read_at ? (
                          <Eye size={12} className="shrink-0 text-accent" />
                        ) : d.received_at ? (
                          <CheckCircle2 size={12} className="shrink-0 text-emerald-300" />
                        ) : d.sent_to_chat_at ? (
                          <CheckCircle2 size={12} className="shrink-0 text-ink-400" />
                        ) : (
                          <AlertCircle size={12} className="shrink-0 text-ink-400" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function PageHeader({ icon: Icon, title, subtitle, trailing, onBack, backLabel }) {
  return (
    <div className="flex items-center gap-3 border-b border-black/20 px-5 py-4">
      {onBack && (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="shrink-0"
          onPress={onBack}
          aria-label={backLabel}
        >
          <ArrowLeft size={18} />
        </Button>
      )}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-ink-200">{subtitle}</p> : null}
      </div>
      {trailing}
    </div>
  );
}

function SelectedChip({ user, onRemove, t }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.75 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.75 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-1 rounded-full bg-accent/15 py-0.5 pl-0.5 pr-2 text-[12px] font-medium text-accent ring-1 ring-inset ring-accent/20"
    >
      <UserAvatar user={user} size="xs" />
      <span className="max-w-[80px] truncate">{user.display_name || user.username}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full text-accent/60 transition-colors hover:text-accent"
        aria-label={t('common.remove')}
      >
        <X size={10} strokeWidth={2.5} />
      </button>
    </motion.span>
  );
}

function UserRow({ user, isSelected, onToggle }) {
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      onClick={() => onToggle(user)}
      className={[
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
        isSelected
          ? 'bg-accent/10 ring-1 ring-inset ring-accent/25'
          : 'hover:bg-ink-750',
      ].join(' ')}
    >
      <UserAvatar user={user} size="sm" showStatus />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold leading-tight text-foreground">
          {user.display_name || user.username}
        </p>
        <p className="truncate text-[11.5px] text-ink-200">
          @{user.username}
          {user.department ? ` · ${user.department}` : ''}
        </p>
      </div>
      <div
        className={[
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all',
          isSelected
            ? 'border-accent bg-accent'
            : 'border-ink-500 bg-transparent',
        ].join(' ')}
      >
        {isSelected && <Check size={9} strokeWidth={3} className="echo-on-accent" />}
      </div>
    </motion.button>
  );
}

function RecipientPicker({
  excludeIds,
  selectedIds,
  selectedUsers,
  onToggle,
  userPicker,
  t,
  className = '',
}) {
  const candidates = useMemo(
    () => userPicker.results.filter((u) => u.id && !excludeIds.has(u.id)),
    [userPicker.results, excludeIds],
  );

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {/* Search — same compact field as /chat/new */}
      <div className="shrink-0 px-0 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2 ring-1 ring-white/5 transition-shadow focus-within:ring-accent/50">
          {userPicker.searching ? (
            <Spinner size="sm" className="shrink-0 text-ink-300" />
          ) : (
            <Search size={13} className="shrink-0 text-ink-300" />
          )}
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-ink-400"
            placeholder={t('broadcasts.searchUsersPlaceholder')}
            value={userPicker.query}
            onChange={(e) => userPicker.setQuery(e.target.value)}
          />
          {userPicker.query && (
            <button
              type="button"
              onClick={() => userPicker.setQuery('')}
              className="shrink-0 rounded-full text-ink-400 transition-colors hover:text-ink-100"
              aria-label={t('common.clear')}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Selected chips */}
      <AnimatePresence>
        {selectedUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="shrink-0 overflow-hidden pb-2"
          >
            <motion.div layout className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {selectedUsers.map((u) => (
                  <SelectedChip key={u.id} user={u} onRemove={() => onToggle(u)} t={t} />
                ))}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results — browse by default, search overlays */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {userPicker.searching && candidates.length === 0 && (
          <div className="flex flex-col gap-0.5 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ opacity: 1 - i * 0.12 }}>
                <div className="echo-shimmer h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="echo-shimmer h-3 w-28 rounded-full" />
                  <div className="echo-shimmer h-2.5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!userPicker.searching && candidates.length === 0 && (
          <p className="px-3 py-8 text-center text-[12px] text-ink-300">
            {userPicker.query.trim().length >= 2
              ? t('broadcasts.noUsersFound')
              : t('broadcasts.noUsersHint')}
          </p>
        )}

        {candidates.length > 0 && (
          <div className="flex flex-col gap-0.5 pt-1">
            {candidates.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelected={selectedIds.has(u.id)}
                onToggle={onToggle}
              />
            ))}

            {userPicker.hasMore && (
              <button
                type="button"
                onClick={userPicker.loadMore}
                disabled={userPicker.pageLoading}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-medium text-ink-300 transition-colors hover:bg-ink-750 hover:text-ink-100 disabled:opacity-50"
              >
                {userPicker.pageLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <ChevronDown size={14} />
                    {t('newConversation.loadMore')}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Create view (full page, no modal) ─────────────────────────────── */
function CreateBroadcastView({ onBack, onCreated, t }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [creating, setCreating] = useState(false);
  const userPicker = useUserPicker();

  const toggle = (user) => {
    const id = user.id;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedUsers((prev) => {
      if (prev.some((u) => u.id === id)) return prev.filter((u) => u.id !== id);
      return [...prev, user];
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.size === 0) return;
    setCreating(true);
    try {
      const res = await broadcastsApi.create({
        name: name.trim(),
        description: description.trim() || null,
        recipient_ids: [...selectedIds],
      });
      onCreated(res.data.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Plus}
        title={t('broadcasts.createTitle')}
        subtitle={
          selectedIds.size > 0
            ? t('broadcasts.selectedCount', { count: selectedIds.size })
            : t('broadcasts.selectRecipients')
        }
        onBack={onBack}
        backLabel={t('broadcasts.back')}
      />

      {/* Name / description — compact like NewConversation config */}
      <div className="shrink-0 space-y-2 border-b border-black/10 px-4 py-3">
        <input
          autoFocus
          className="w-full bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder:text-ink-400"
          placeholder={t('broadcasts.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full bg-transparent text-[13px] text-ink-200 outline-none placeholder:text-ink-400"
          placeholder={`${t('broadcasts.description')} (${t('common.optional')})`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pt-3">
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-200">
          {t('broadcasts.selectRecipients')}
        </p>
        <RecipientPicker
          excludeIds={new Set()}
          selectedIds={selectedIds}
          selectedUsers={selectedUsers}
          onToggle={toggle}
          userPicker={userPicker}
          t={t}
          className="min-h-0 flex-1"
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-black/20 px-4 py-3">
        <Button variant="ghost" onPress={onBack}>{t('common.cancel')}</Button>
        <Button
          className="gap-2"
          isPending={creating}
          onPress={handleCreate}
          isDisabled={!name.trim() || selectedIds.size === 0}
        >
          <Plus size={16} />
          {t('broadcasts.create')}
        </Button>
      </div>
    </div>
  );
}

/* ── Detail view ───────────────────────────────────────────────────── */
function BroadcastDetail({ listId, onBack, t }) {
  const [list, setList] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState(null);
  const [sending, setSending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [department, setDepartment] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const userPicker = useUserPicker();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, msgRes] = await Promise.all([
        broadcastsApi.getById(listId),
        broadcastsApi.getMessages(listId),
      ]);
      setList(listRes.data);
      setMessages(msgRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { load(); }, [load]);

  const existingIds = useMemo(
    () => new Set((list?.recipients || []).map((r) => r.user_id)),
    [list?.recipients],
  );

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const payload = { body: body.trim() };
      if (scheduledAt) {
        payload.scheduled_at = scheduledAt.toDate(getLocalTimeZone()).toISOString();
      }
      await broadcastsApi.sendMessage(listId, payload);
      setBody('');
      setScheduledAt(null);
      await load();
    } finally {
      setSending(false);
    }
  };

  const handleRemoveRecipient = async (userId) => {
    await broadcastsApi.removeRecipient(listId, userId);
    await load();
  };

  const toggle = (user) => {
    const id = user.id;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedUsers((prev) => {
      if (prev.some((u) => u.id === id)) return prev.filter((u) => u.id !== id);
      return [...prev, user];
    });
  };

  const handleAddRecipients = async () => {
    const data = {};
    if (selectedIds.size) data.recipient_ids = [...selectedIds];
    if (department.trim()) data.department = department.trim();
    if (!data.recipient_ids?.length && !data.department) return;
    setAddingBusy(true);
    try {
      await broadcastsApi.addRecipients(listId, data);
      setSelectedIds(new Set());
      setSelectedUsers([]);
      setDepartment('');
      userPicker.reset();
      setAdding(false);
      await load();
    } finally {
      setAddingBusy(false);
    }
  };

  const closeAdding = () => {
    setAdding(false);
    setSelectedIds(new Set());
    setSelectedUsers([]);
    setDepartment('');
    userPicker.reset();
  };

  if (loading && !list) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Megaphone}
        title={list?.name || t('broadcasts.title')}
        subtitle={list?.description || t('broadcasts.recipientsCount', { count: list?.recipients?.length || 0 })}
        onBack={onBack}
        backLabel={t('broadcasts.back')}
      />

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(260px,320px)_1fr]">
        {/* Recipients column */}
        <aside className="flex min-h-0 flex-col border-b border-black/20 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-sm font-semibold">
              {adding
                ? t('broadcasts.addRecipients')
                : `${t('broadcasts.recipients')} (${list?.recipients?.length || 0})`}
            </h2>
            {adding ? (
              <Button size="sm" variant="ghost" onPress={closeAdding}>{t('common.cancel')}</Button>
            ) : (
              <Button size="sm" variant="secondary" className="gap-1" onPress={() => setAdding(true)}>
                <Plus size={14} />
                {t('broadcasts.add')}
              </Button>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {adding ? (
              <motion.div
                key="add"
                {...PANEL_FADE}
                className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4"
              >
                <RecipientPicker
                  excludeIds={existingIds}
                  selectedIds={selectedIds}
                  selectedUsers={selectedUsers}
                  onToggle={toggle}
                  userPicker={userPicker}
                  t={t}
                  className="min-h-0 flex-1"
                />
                <div className="flex flex-col gap-1.5 px-1">
                  <TextField fullWidth>
                    <Label className="flex items-center gap-1.5">
                      <Building2 size={12} />
                      {t('broadcasts.department')}
                    </Label>
                    <Input
                      fullWidth
                      placeholder={t('broadcasts.departmentPlaceholder')}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </TextField>
                </div>
                <Button
                  className="w-full gap-2"
                  isPending={addingBusy}
                  onPress={handleAddRecipients}
                  isDisabled={selectedIds.size === 0 && !department.trim()}
                >
                  <Plus size={16} />
                  {t('broadcasts.add')}
                  {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                </Button>
              </motion.div>
            ) : (
              <motion.ul
                key="list"
                {...PANEL_FADE}
                className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4"
              >
                {(list?.recipients || []).length === 0 ? (
                  <li className="px-3 py-8 text-center text-xs text-ink-200">
                    {t('broadcasts.noRecipients')}
                  </li>
                ) : (
                  (list?.recipients || []).map((r) => {
                    const user = toPickerUser(r);
                    return (
                      <li
                        key={r.user_id}
                        className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-ink-750"
                      >
                        <UserAvatar user={user} size="sm" showStatus />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{user.display_name}</p>
                          {r.department ? (
                            <p className="truncate text-xs text-muted">{r.department}</p>
                          ) : r.username ? (
                            <p className="truncate text-xs text-muted">@{r.username}</p>
                          ) : null}
                        </div>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-label={t('broadcasts.removeRecipient')}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          onPress={() => handleRemoveRecipient(r.user_id)}
                        >
                          <Trash2 size={14} className="text-ink-200" />
                        </Button>
                      </li>
                    );
                  })
                )}
              </motion.ul>
            )}
          </AnimatePresence>
        </aside>

        {/* Compose + history */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-5">
          <section className="echo-panel-solid echo-e2 flex flex-col gap-3 p-4 rounded-2xl">
            <h3 className="text-sm font-semibold">{t('broadcasts.compose')}</h3>

            <TextField fullWidth>
              <Label>{t('broadcasts.bodyPlaceholder')}</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.TextArea
                  className="min-h-28"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('broadcasts.bodyPlaceholder')}
                />
              </InputGroup>
            </TextField>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <DatePicker
                className="min-w-0 flex-1"
                value={scheduledAt}
                onChange={setScheduledAt}
                granularity="minute"
                hourCycle={24}
                hideTimeZone
                aria-label={t('broadcasts.scheduleOptional')}
              >
                {({ state }) => (
                  <>
                    <Label>{t('broadcasts.scheduleOptional')}</Label>
                    <DateField.Group fullWidth variant="secondary">
                      <DateField.Input>
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                      <DateField.Suffix>
                        {scheduledAt ? (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            aria-label={t('common.clear')}
                            onPress={() => setScheduledAt(null)}
                            className="mr-0.5"
                          >
                            <X size={14} />
                          </Button>
                        ) : null}
                        <DatePicker.Trigger>
                          <DatePicker.TriggerIndicator />
                        </DatePicker.Trigger>
                      </DateField.Suffix>
                    </DateField.Group>
                    <DatePicker.Popover className="flex flex-col gap-3 p-3">
                      <Calendar aria-label={t('broadcasts.scheduleOptional')}>
                        <Calendar.Header>
                          <Calendar.YearPickerTrigger>
                            <Calendar.YearPickerTriggerHeading />
                            <Calendar.YearPickerTriggerIndicator />
                          </Calendar.YearPickerTrigger>
                          <Calendar.NavButton slot="previous" />
                          <Calendar.NavButton slot="next" />
                        </Calendar.Header>
                        <Calendar.Grid>
                          <Calendar.GridHeader>
                            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                          </Calendar.GridHeader>
                          <Calendar.GridBody>
                            {(date) => <Calendar.Cell date={date} />}
                          </Calendar.GridBody>
                        </Calendar.Grid>
                        <Calendar.YearPickerGrid>
                          <Calendar.YearPickerGridBody>
                            {({ year }) => <Calendar.YearPickerCell year={year} />}
                          </Calendar.YearPickerGridBody>
                        </Calendar.YearPickerGrid>
                      </Calendar>
                      <div className="flex items-center justify-between gap-3">
                        <Label>{t('broadcasts.scheduleTime')}</Label>
                        <TimeField
                          aria-label={t('broadcasts.scheduleTime')}
                          granularity="minute"
                          hourCycle={24}
                          hideTimeZone
                          value={state.timeValue}
                          onChange={(v) => state.setTimeValue(v)}
                        >
                          <TimeField.Group variant="secondary">
                            <TimeField.Input>
                              {(segment) => <TimeField.Segment segment={segment} />}
                            </TimeField.Input>
                          </TimeField.Group>
                        </TimeField>
                      </div>
                    </DatePicker.Popover>
                  </>
                )}
              </DatePicker>

              <Button
                className="shrink-0 gap-2"
                isPending={sending}
                onPress={handleSend}
                isDisabled={!body.trim()}
              >
                <Send size={16} />
                {scheduledAt ? t('broadcasts.schedule') : t('broadcasts.sendNow')}
              </Button>
            </div>
          </section>

          <section className="echo-panel-solid echo-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('broadcasts.history')}</h3>
            <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
              {messages.length === 0 && (
                <li className="py-8 text-center text-sm text-ink-200">{t('broadcasts.noMessages')}</li>
              )}
              {messages.map((msg) => (
                <HistoryMessageCard key={msg.id} msg={msg} listId={listId} t={t} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── List view ─────────────────────────────────────────────────────── */
function BroadcastListView({ lists, loading, error, reducedMotion, onCreate, onOpen, t }) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Megaphone}
        title={t('broadcasts.title')}
        subtitle={t('broadcasts.subtitle')}
        trailing={
          <Button className="shrink-0 gap-2" onPress={onCreate} isDisabled={!!error}>
            <Plus size={16} />
            <span className="hidden sm:inline">{t('broadcasts.create')}</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex flex-col gap-2" role="status" aria-label={t('common.loading')}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-800/40 p-4"
                style={{ opacity: 1 - i * 0.15 }}
              >
                <div className="echo-shimmer h-11 w-11 shrink-0 rounded-2xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="echo-shimmer h-3.5 w-1/3 rounded-full" />
                  <div className="echo-shimmer h-2.5 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-16 text-center"
          >
            <AlertCircle size={36} className="text-ink-200" />
            <p className="text-sm text-ink-200">{error}</p>
          </motion.div>
        ) : lists.length === 0 ? (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-16 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/10 text-accent">
              <Megaphone size={28} />
            </div>
            <p className="text-sm text-ink-200">{t('broadcasts.empty')}</p>
            <Button variant="secondary" className="gap-2" onPress={onCreate}>
              <Plus size={14} />
              {t('broadcasts.createFirst')}
            </Button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2">
            {lists.map((list, i) => (
              <motion.button
                key={list.id}
                type="button"
                {...listItemEntry(i, reducedMotion)}
                onClick={() => onOpen(list.id)}
                className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-ink-800/40 p-4 text-left transition-colors hover:border-accent/30 hover:bg-ink-750"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent transition-transform group-hover:scale-105">
                  <Megaphone size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-semibold">{list.name}</h3>
                  {list.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-200">{list.description}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-ink-200">{t('broadcasts.listMeta')}</p>
                  )}
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink-700/80 px-2.5 py-1 text-[11px] font-medium text-ink-100">
                  <Users size={12} />
                  {t('broadcasts.recipientsCount', { count: list.recipient_count ?? 0 })}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [view, setView] = useState('list'); // 'list' | 'create' | 'detail'
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
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
  }, [loadLists]);

  const openDetail = (id) => {
    setSelectedId(id);
    setView('detail');
  };

  const backToList = () => {
    setSelectedId(null);
    setView('list');
    loadLists();
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view === 'detail' ? `detail-${selectedId}` : view}
        {...(reducedMotion ? {} : PANEL_FADE)}
        className="h-full"
      >
        {view === 'create' && (
          <CreateBroadcastView
            t={t}
            onBack={() => setView('list')}
            onCreated={(id) => openDetail(id)}
          />
        )}
        {view === 'detail' && selectedId && (
          <BroadcastDetail
            listId={selectedId}
            t={t}
            onBack={backToList}
          />
        )}
        {view === 'list' && (
          <BroadcastListView
            lists={lists}
            loading={loading}
            error={error}
            reducedMotion={reducedMotion}
            t={t}
            onCreate={() => setView('create')}
            onOpen={openDetail}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
