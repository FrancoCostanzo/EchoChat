import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button, Tabs, Spinner, Tooltip, toast } from '@heroui/react';
import {
  Search,
  UserPlus,
  Star,
  Ban,
  Trash2,
  StarOff,
  ArrowLeft,
  Users,
  MessageSquare,
  X,
  Check,
  ChevronDown,
  UserMinus,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { relationshipsApi, usersApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import UserAvatar from '@/components/UserAvatar';
import NotFoundIcon from '@/components/NotFoundIcon';
import { listItemEntry, PANEL_FADE } from '@/lib/motion';

const PAGE_SIZE = 20;

/** Relationship rows use `target_user_id`; search results use `id`. */
function targetIdOf(user) {
  return user.target_user_id || user.id;
}

function ContactCard({ user, type, onRemove, onToggleFavorite, onMessage, messaging }) {
  const { t } = useTranslation();
  return (
    <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-750">
      <UserAvatar user={user} showStatus size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold leading-tight text-foreground">
          {user.display_name || user.username}
        </p>
        <p className="truncate text-[11.5px] text-ink-200">
          {user.username ? `@${user.username}` : ''}
          {user.department ? `${user.username ? ' · ' : ''}${user.department}` : ''}
        </p>
      </div>
      <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {type === 'contact' && (
          <>
            <Tooltip delay={200} placement="top">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                isPending={messaging}
                onPress={() => onMessage(user)}
                aria-label={t('contacts.sendMessage')}
                className="text-accent"
              >
                <MessageSquare size={16} />
              </Button>
              <Tooltip.Content><p>{t('contacts.sendMessage')}</p></Tooltip.Content>
            </Tooltip>
            <Tooltip delay={200} placement="top">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => onToggleFavorite(user)}
                aria-label={user.is_favorite ? t('contacts.removeFavorite') : t('contacts.addFavorite')}
              >
                {user.is_favorite ? <StarOff size={16} /> : <Star size={16} />}
              </Button>
              <Tooltip.Content>
                <p>{user.is_favorite ? t('contacts.removeFavorite') : t('contacts.addFavorite')}</p>
              </Tooltip.Content>
            </Tooltip>
          </>
        )}
        <Button
          isIconOnly
          size="sm"
          variant={type === 'blocked' ? 'secondary' : 'danger'}
          onPress={() => onRemove(user)}
          aria-label={type === 'blocked' ? t('contacts.unblock') : t('common.delete')}
        >
          {type === 'blocked' ? <Ban size={16} /> : <Trash2 size={16} />}
        </Button>
      </div>
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 pt-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ opacity: 1 - i * 0.12 }}>
          <div className="echo-shimmer h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="echo-shimmer h-3 w-32 rounded-full" />
            <div className="echo-shimmer h-2.5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AddUserRow({ user, isContact, adding, onAdd, t }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-750">
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
      {isContact ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          <Check size={12} strokeWidth={2.5} />
          {t('contacts.alreadyAdded')}
        </span>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          isPending={adding}
          onPress={() => onAdd(user)}
        >
          <UserPlus size={14} />
          {t('contacts.add')}
        </Button>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const createConversation = useChatStore((s) => s.createConversation);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const selfId = useAuthStore((s) => s.user?.id);

  const [tab, setTab] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagingId, setMessagingId] = useState(null);
  const [addingId, setAddingId] = useState(null);

  /* browse / search (mirrors /chat/new) */
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const contactIds = useMemo(
    () => new Set(contacts.map((c) => targetIdOf(c))),
    [contacts],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, f, b] = await Promise.all([
        relationshipsApi.getContacts(),
        relationshipsApi.getFavorites(),
        relationshipsApi.getBlocked(),
      ]);
      setContacts(c.data || []);
      setFavorites(f.data || []);
      setBlocked(b.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const loadPage = useCallback(async (currentOffset, replace = false) => {
    setPageLoading(true);
    try {
      const { data } = await usersApi.search('', PAGE_SIZE, currentOffset);
      const page = (data || []).filter((u) => u.id !== selfId);
      setResults((prev) => (replace ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE_SIZE);
      setOffset(currentOffset + page.length);
    } catch {
      setHasMore(false);
    } finally {
      setPageLoading(false);
    }
  }, [selfId]);

  // Browse users when opening the "add" tab
  useEffect(() => {
    if (tab !== 'add') return;
    setSearch('');
    setOffset(0);
    setHasMore(true);
    loadPage(0, true);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search — overrides browse while typing
  useEffect(() => {
    if (tab !== 'add') return undefined;
    if (search.trim().length === 0) {
      setOffset(0);
      setHasMore(true);
      loadPage(0, true);
      return undefined;
    }
    if (search.trim().length < 2) return undefined;
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(search.trim(), 40, 0);
        setResults((data || []).filter((u) => u.id !== selfId));
        setHasMore(false);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, tab, selfId, loadPage]);

  const addContact = async (user) => {
    const id = targetIdOf(user);
    const name = user.display_name || user.username;
    setAddingId(id);
    try {
      await relationshipsApi.create({ target_user_id: id, type: 'contact' });
      toast.success(t('contacts.addedToast', { name }), {
        indicator: <UserPlus size={16} />,
      });
      await fetchAll();
    } catch (err) {
      toast.danger(err?.message || t('contacts.addError'), {
        indicator: <AlertCircle size={16} />,
      });
    } finally {
      setAddingId(null);
    }
  };

  const removeContact = async (user) => {
    const name = user.display_name || user.username;
    try {
      await relationshipsApi.remove(targetIdOf(user), 'contact');
      toast.success(t('contacts.removedToast', { name }), {
        indicator: <UserMinus size={16} />,
      });
      await fetchAll();
    } catch (err) {
      toast.danger(err?.message || t('contacts.removeError'), {
        indicator: <AlertCircle size={16} />,
      });
    }
  };

  const toggleFavorite = async (user) => {
    const targetId = targetIdOf(user);
    const name = user.display_name || user.username;
    const isFav = favorites.some((f) => targetIdOf(f) === targetId);
    try {
      if (isFav) {
        await relationshipsApi.remove(targetId, 'favorite');
        toast.success(t('contacts.unfavoritedToast', { name }), {
          indicator: <StarOff size={16} />,
        });
      } else {
        await relationshipsApi.create({ target_user_id: targetId, type: 'favorite' });
        toast.success(t('contacts.favoritedToast', { name }), {
          indicator: <Star size={16} />,
        });
      }
      await fetchAll();
    } catch (err) {
      toast.danger(err?.message || t('contacts.favoriteError'), {
        indicator: <AlertCircle size={16} />,
      });
    }
  };

  const unblock = async (user) => {
    const name = user.display_name || user.username;
    try {
      await relationshipsApi.remove(targetIdOf(user), 'blocked');
      toast.success(t('contacts.unblockedToast', { name }), {
        indicator: <Ban size={16} />,
      });
      await fetchAll();
    } catch (err) {
      toast.danger(err?.message || t('contacts.unblockError'), {
        indicator: <AlertCircle size={16} />,
      });
    }
  };

  const messageContact = async (user) => {
    const id = targetIdOf(user);
    setMessagingId(id);
    try {
      const conv = await createConversation({ type: 'direct', member_ids: [id] });
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      toast.danger(err?.message || t('contacts.messageError'), {
        indicator: <AlertCircle size={16} />,
      });
    } finally {
      setMessagingId(null);
    }
  };

  const getList = () => {
    switch (tab) {
      case 'favorites':
        return favorites;
      case 'blocked':
        return blocked;
      default:
        return contacts;
    }
  };

  const listWithPresence = useMemo(
    () => getList().map((u) => ({ ...u, presence: onlineUsers[targetIdOf(u)] ?? u.presence })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, contacts, favorites, blocked, onlineUsers],
  );

  const listBusy = searching || (pageLoading && results.length === 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-black/20 px-5 py-4">
        <Button isIconOnly size="sm" variant="ghost" className="md:hidden shrink-0" onPress={() => navigate('/chat')}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Users size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">{t('contacts.title')}</h1>
          <p className="truncate text-xs text-ink-200">{t('contacts.sections')}</p>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-2">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => setTab(String(key))}
          className="w-full"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('contacts.sections')} className="w-full">
              <Tabs.Tab id="contacts">
                {`${t('contacts.contacts')} (${contacts.length})`}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="favorites">
                {`${t('contacts.favorites')} (${favorites.length})`}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="blocked">
                {`${t('contacts.blocked')} (${blocked.length})`}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="add">
                <span className="inline-flex items-center gap-1.5">
                  <UserPlus size={13} strokeWidth={2.5} />
                  {t('contacts.add')}
                </span>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          {...(reducedMotion ? {} : PANEL_FADE)}
          className="flex min-h-0 flex-1 flex-col"
        >
          {tab === 'add' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 px-4 pb-2">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-300">
                  {t('contacts.searchUsers')}
                </label>
                <div className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2 ring-1 ring-white/5 transition-shadow focus-within:ring-accent/50">
                  {listBusy ? (
                    <Spinner size="sm" className="shrink-0 text-ink-300" />
                  ) : (
                    <Search size={13} className="shrink-0 text-ink-300" />
                  )}
                  <input
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-ink-400"
                    placeholder={t('contacts.searchToAdd')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="shrink-0 rounded-full text-ink-400 transition-colors hover:text-ink-100"
                      aria-label={t('common.clear')}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                {listBusy && (
                  <ContactSkeleton />
                )}

                {!listBusy && results.length === 0 && (
                  <p className="px-3 py-8 text-center text-[12px] text-ink-300">
                    {search.trim().length >= 2
                      ? t('contacts.noUsersFound')
                      : t('contacts.noUsersHint')}
                  </p>
                )}

                {results.length > 0 && (
                  <div className="flex flex-col gap-0.5 pt-1">
                    {results.map((u, i) => (
                      <motion.div key={u.id} {...listItemEntry(i, reducedMotion)}>
                        <AddUserRow
                          user={u}
                          isContact={contactIds.has(u.id)}
                          adding={addingId === u.id}
                          onAdd={addContact}
                          t={t}
                        />
                      </motion.div>
                    ))}

                    {hasMore && !search.trim() && (
                      <button
                        type="button"
                        onClick={() => loadPage(offset, false)}
                        disabled={pageLoading}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-medium text-ink-300 transition-colors hover:bg-ink-750 hover:text-ink-100 disabled:opacity-50"
                      >
                        {pageLoading ? (
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
          ) : (
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {loading ? (
                <ContactSkeleton />
              ) : listWithPresence.length === 0 ? (
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.22 }}
                  className="flex flex-col items-center"
                >
                  <NotFoundIcon
                    icon={tab === 'blocked' ? Ban : Users}
                    title={
                      tab === 'contacts' ? t('contacts.noContacts') :
                      tab === 'favorites' ? t('contacts.noFavorites') :
                      t('contacts.noBlocked')
                    }
                  />
                  {tab === 'contacts' && (
                    <Button size="sm" variant="secondary" className="gap-1.5" onPress={() => setTab('add')}>
                      <UserPlus size={14} />
                      {t('contacts.add')}
                    </Button>
                  )}
                </motion.div>
              ) : (
                listWithPresence.map((u, i) => (
                  <motion.div key={u.id || targetIdOf(u)} {...listItemEntry(i, reducedMotion)}>
                    <ContactCard
                      user={{ ...u, is_favorite: favorites.some((f) => targetIdOf(f) === targetIdOf(u)) }}
                      type={tab === 'blocked' ? 'blocked' : 'contact'}
                      onRemove={tab === 'blocked' ? unblock : removeContact}
                      onToggleFavorite={toggleFavorite}
                      onMessage={messageContact}
                      messaging={messagingId === targetIdOf(u)}
                    />
                  </motion.div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
