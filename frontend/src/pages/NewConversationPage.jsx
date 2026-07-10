import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  User,
  Hash,
  Search,
  X,
  Check,
  Globe,
  Lock,
  FileText,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usersApi, channelsApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import UserAvatar from '@/components/UserAvatar';

/* ── constants ─────────────────────────────────────────────── */
const TABS = [
  { id: 'direct',  Icon: User,  labelKey: 'newConversation.direct'  },
  { id: 'group',   Icon: Users, labelKey: 'newConversation.group'   },
  { id: 'channel', Icon: Hash,  labelKey: 'newConversation.channel' },
];

const JOIN_MODES = [
  { id: 'open',         Icon: Globe,    labelKey: 'newConversation.joinModes.open'        },
  { id: 'request',      Icon: FileText, labelKey: 'newConversation.joinModes.request'     },
  { id: 'invite_only',  Icon: Lock,     labelKey: 'newConversation.joinModes.invite_only' },
];

const CATEGORIES = ['general', 'announcements', 'department', 'project'];

/* ── helpers ─────────────────────────────────────────────────── */
function SelectedChip({ user, onRemove }) {
  const { t } = useTranslation();
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
      <span className="max-w-[80px] truncate">{user.display_name}</span>
      <button
        onClick={() => onRemove(user.id)}
        className="ml-0.5 rounded-full text-accent/60 transition-colors hover:text-accent"
        aria-label={t('common.remove')}
      >
        <X size={10} strokeWidth={2.5} />
      </button>
    </motion.span>
  );
}

function UserRow({ user, isSelected, onToggle, isMulti }) {
  return (
    <motion.button
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
          {user.display_name}
        </p>
        <p className="truncate text-[11.5px] text-ink-200">
          @{user.username}
          {user.department ? ` · ${user.department}` : ''}
        </p>
      </div>
      {isMulti ? (
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
      ) : (
        <ChevronRight size={14} className="shrink-0 text-ink-300" />
      )}
    </motion.button>
  );
}

/* ── main component ─────────────────────────────────────────── */
export default function NewConversationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createConversation = useChatStore((s) => s.createConversation);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const selfId = useAuthStore((s) => s.user?.id);

  const [tab, setTab] = useState('direct');

  /* search */
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  /* pagination (used when search is empty) */
  const PAGE_SIZE = 20;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const listRef = useRef(null);

  /* selection */
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  /* config fields */
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinMode, setJoinMode] = useState('open');
  const [category, setCategory] = useState('general');

  /* submission */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* load a page of users (no query = browse all) */
  const loadPage = useCallback(async (currentOffset, replace = false) => {
    setPageLoading(true);
    try {
      const { data } = await usersApi.search('', PAGE_SIZE, currentOffset);
      const page = (data || []).filter((u) => u.id !== selfId);
      setResults((prev) => replace ? page : [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
      setOffset(currentOffset + page.length);
    } catch {
      setHasMore(false);
    } finally {
      setPageLoading(false);
    }
  }, []);

  /* initial load + reset on tab change */
  useEffect(() => {
    setSearch('');
    setResults([]);
    setSelectedIds([]);
    setSelectedUsers([]);
    setName('');
    setDescription('');
    setJoinMode('open');
    setCategory('general');
    setError('');
    setOffset(0);
    setHasMore(true);
    loadPage(0, true);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* debounced search — overrides browse list while typing */
  useEffect(() => {
    if (search.length === 0) {
      // back to browse mode: restore the paginated list
      setOffset(0);
      setHasMore(true);
      loadPage(0, true);
      return;
    }
    setSearchLoading(true);
    const tid = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(search, 40, 0);
        setResults((data || []).filter((u) => u.id !== selfId));
        setHasMore(false); // no pagination while searching
      } catch {
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(tid);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleUser = useCallback((user) => {
    const id = user.id;
    if (tab === 'direct') {
      setSelectedIds([id]);
      setSelectedUsers([user]);
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === id)
        ? prev.filter((u) => u.id !== id)
        : [...prev, user],
    );
  }, [tab]);

  const removeUser = useCallback((id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const canCreate =
    tab === 'direct'
      ? selectedIds.length === 1
      : selectedIds.length >= 1 && name.trim().length >= 1;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    setError('');
    try {
      if (tab === 'channel') {
        const res = await channelsApi.create({
          name: name.trim(),
          description: description.trim() || undefined,
          join_mode: joinMode,
          category,
          member_ids: selectedIds,
        });
        await fetchConversations();
        navigate(`/chat/${res.data.id}`);
      } else {
        const payload =
          tab === 'direct'
            ? { type: 'direct', member_ids: [selectedIds[0]] }
            : {
                type: 'group',
                name: name.trim(),
                description: description.trim() || undefined,
                member_ids: selectedIds,
              };
        const conv = await createConversation(payload);
        navigate(`/chat/${conv.id}`);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || t('channels.error'));
    } finally {
      setLoading(false);
    }
  };

  const isMulti = tab !== 'direct';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/5 px-3 shadow-sm">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="h-7 w-7 min-w-0"
          onPress={() => navigate('/chat')}
        >
          <ArrowLeft size={15} />
        </Button>
        <h2 className="echo-display text-[16px] font-semibold leading-tight">
          {t('newConversation.title')}
        </h2>
      </div>

      {/* ── Type tabs ────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex gap-1.5 rounded-xl bg-ink-850 p-1">
          {TABS.map(({ id, Icon, labelKey }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all duration-200',
                tab === id
                  ? 'echo-grad-brand echo-glow-md echo-on-accent'
                  : 'text-ink-200 hover:text-ink-100',
              ].join(' ')}
            >
              <Icon size={13} strokeWidth={2.5} />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Config fields (group / channel) ──────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {tab !== 'direct' && (
          <motion.div
            key={tab + '-config'}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0 overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 px-3 pb-3">
              {/* Name */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-ink-300">
                  {tab === 'channel'
                    ? t('newConversation.channelName')
                    : t('newConversation.groupChannelName')}
                </label>
                <div className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2 ring-1 ring-white/5 focus-within:ring-accent/50 transition-shadow">
                  {tab === 'channel' && (
                    <Hash size={13} className="shrink-0 text-ink-300" />
                  )}
                  <input
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-ink-400 outline-none"
                    placeholder={
                      tab === 'channel'
                        ? t('newConversation.channelNamePlaceholder')
                        : t('newConversation.groupNamePlaceholder')
                    }
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-ink-300">
                  {t('newConversation.description')}{' '}
                  <span className="normal-case font-normal text-ink-400">
                    ({t('common.optional')})
                  </span>
                </label>
                <div className="flex items-start gap-2 rounded-lg bg-ink-800 px-3 py-2 ring-1 ring-white/5 focus-within:ring-accent/50 transition-shadow">
                  <input
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-ink-400 outline-none"
                    placeholder={t('newConversation.descriptionPlaceholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>

              {/* Channel-only extras */}
              <AnimatePresence initial={false}>
                {tab === 'channel' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-2.5 overflow-hidden"
                  >
                    {/* Join mode */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-300">
                        {t('newConversation.joinMode')}
                      </label>
                      <div className="flex gap-1.5">
                        {JOIN_MODES.map(({ id, Icon, labelKey }) => (
                          <button
                            key={id}
                            onClick={() => setJoinMode(id)}
                            className={[
                              'flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center text-[10.5px] font-semibold transition-all',
                              joinMode === id
                                ? 'border-accent/50 bg-accent/12 text-accent'
                                : 'border-white/5 bg-ink-800 text-ink-300 hover:border-white/10 hover:text-ink-100',
                            ].join(' ')}
                          >
                            <Icon size={14} />
                            {t(labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-300">
                        {t('newConversation.category')}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={[
                              'rounded-full px-3 py-1 text-[11px] font-semibold transition-all',
                              category === cat
                                ? 'bg-accent echo-on-accent echo-glow-sm'
                                : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-100',
                            ].join(' ')}
                          >
                            {t(`channels.categories.${cat}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* divider */}
            <div className="mx-3 mb-2 border-t border-white/5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search ───────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pb-2">
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-300">
          {isMulti
            ? t('newConversation.addMembers')
            : t('newConversation.searchUsers')}
        </label>
        <div className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2 ring-1 ring-white/5 focus-within:ring-accent/50 transition-shadow">
          {searchLoading ? (
            <Spinner size="sm" color="current" className="shrink-0 text-ink-300" />
          ) : (
            <Search size={13} className="shrink-0 text-ink-300" />
          )}
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-ink-400 outline-none"
            placeholder={t('newConversation.searchUsersPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="shrink-0 rounded-full text-ink-400 transition-colors hover:text-ink-100"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Selected chips ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="shrink-0 overflow-hidden px-3 pb-2"
          >
            <motion.div layout className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {selectedUsers.map((u) => (
                  <SelectedChip key={u.id} user={u} onRemove={removeUser} />
                ))}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results list ─────────────────────────────────────── */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {/* Initial loading skeleton */}
        {pageLoading && results.length === 0 && (
          <div className="flex flex-col gap-0.5 pt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5 animate-pulse">
                <div className="h-8 w-8 shrink-0 rounded-full bg-ink-700" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-3 w-28 rounded-full bg-ink-700" />
                  <div className="h-2.5 w-20 rounded-full bg-ink-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results (searching) */}
        {!pageLoading && !searchLoading && search.length > 0 && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-ink-300">
            <p className="text-[12px]">
              {t('newConversation.noResults', { query: search })}
            </p>
          </div>
        )}

        {/* User rows */}
        {results.length > 0 && (
          <div className="flex flex-col gap-0.5 pt-1">
            {results.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelected={selectedIds.includes(u.id)}
                onToggle={toggleUser}
                isMulti={isMulti}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => loadPage(offset)}
                disabled={pageLoading}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-medium text-ink-300 transition-colors hover:bg-ink-750 hover:text-ink-100 disabled:opacity-50"
              >
                {pageLoading ? (
                  <Spinner size="sm" color="current" />
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

      {/* ── Error ────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="shrink-0 mx-3 mb-2 rounded-lg bg-echo-dnd/12 px-3 py-2 text-[12px] text-echo-dnd ring-1 ring-echo-dnd/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create button ────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/5 px-3 py-3">
        <Button
          className="w-full"
          isDisabled={!canCreate}
          isPending={loading}
          onPress={handleCreate}
        >
          {({ isPending }) =>
            isPending ? (
              <>
                <Spinner size="sm" color="current" />
                {t('chat.creating')}
              </>
            ) : tab === 'direct' ? (
              t('newConversation.startConversation')
            ) : tab === 'group' ? (
              t('newConversation.createGroup', { count: selectedIds.length })
            ) : (
              t('newConversation.createChannel', { count: selectedIds.length })
            )
          }
        </Button>
      </div>
    </div>
  );
}
