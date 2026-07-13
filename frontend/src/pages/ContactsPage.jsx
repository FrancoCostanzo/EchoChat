import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Input, Button, Tabs, Spinner, Tooltip } from '@heroui/react';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { relationshipsApi, usersApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';
import NotFoundIcon from '@/components/NotFoundIcon';
import { listItemEntry, PANEL_FADE } from '@/lib/motion';

function ContactCard({ user, type, onRemove, onToggleFavorite, onMessage, messaging }) {
  const { t } = useTranslation();
  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-ink-750">
      <UserAvatar user={user} showStatus size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.display_name || user.username}</p>
        {user.department && (
          <p className="truncate text-xs text-muted">{user.department}</p>
        )}
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
          variant="danger"
          onPress={() => onRemove(user)}
          aria-label={type === 'blocked' ? t('contacts.blocked') : t('common.delete')}
        >
          {type === 'blocked' ? <Ban size={16} /> : <Trash2 size={16} />}
        </Button>
      </div>
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="flex flex-col gap-1 pt-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ opacity: 1 - i * 0.12 }}>
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

export default function ContactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const createConversation = useChatStore((s) => s.createConversation);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const [tab, setTab] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagingId, setMessagingId] = useState(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, f, b] = await Promise.all([
        relationshipsApi.getContacts(),
        relationshipsApi.getFavorites(),
        relationshipsApi.getBlocked(),
      ]);
      setContacts(c.data);
      setFavorites(f.data);
      setBlocked(b.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await usersApi.search(search);
        setSearchResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Relationship rows carry the target user in `target_user_id`; plain user
  // search results (the "add" tab) expose it as `id`.
  const targetIdOf = (user) => user.target_user_id || user.id;

  const addContact = async (user) => {
    await relationshipsApi.create({ target_user_id: targetIdOf(user), type: 'contact' });
    fetchAll();
  };

  const removeContact = async (user) => {
    await relationshipsApi.remove(targetIdOf(user), 'contact');
    fetchAll();
  };

  const toggleFavorite = async (user) => {
    const targetId = targetIdOf(user);
    const isFav = favorites.some((f) => targetIdOf(f) === targetId);
    if (isFav) {
      await relationshipsApi.remove(targetId, 'favorite');
    } else {
      await relationshipsApi.create({ target_user_id: targetId, type: 'favorite' });
    }
    fetchAll();
  };

  const unblock = async (user) => {
    await relationshipsApi.remove(targetIdOf(user), 'blocked');
    fetchAll();
  };

  // Open (or create) the direct conversation with this contact
  const messageContact = async (user) => {
    setMessagingId(user.id);
    try {
      const conv = await createConversation({ type: 'direct', member_ids: [targetIdOf(user)] });
      navigate(`/chat/${conv.id}`);
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

  // Contacts/favorites/blocked are fetched once via REST; overlay live
  // presence from the socket so status dots don't go stale while the page stays open.
  const listWithPresence = useMemo(
    () => getList().map((u) => ({ ...u, presence: onlineUsers[targetIdOf(u)] ?? u.presence })),
    [tab, contacts, favorites, blocked, onlineUsers],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header — consistent with Saved / Explore pages */}
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

      <div className="px-4 py-3">
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <Tabs.List aria-label={t('contacts.sections')}>
            <Tabs.Tab id="contacts">{`${t('contacts.contacts')} (${contacts.length})`}</Tabs.Tab>
            <Tabs.Tab id="favorites">{`${t('contacts.favorites')} (${favorites.length})`}</Tabs.Tab>
            <Tabs.Tab id="blocked">{`${t('contacts.blocked')} (${blocked.length})`}</Tabs.Tab>
            <Tabs.Tab id="add">{t('contacts.add')}</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          {...(reducedMotion ? {} : PANEL_FADE)}
          className="flex min-h-0 flex-1 flex-col"
        >
          {tab === 'add' ? (
            <div className="flex flex-1 flex-col px-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <Input
                  placeholder={t('contacts.searchToAdd')}
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="mt-2 flex-1 overflow-y-auto">
                {searching && (
                  <div className="flex justify-center py-4">
                    <Spinner size="sm" />
                  </div>
                )}
                {searchResults.map((u, i) => (
                  <motion.div
                    key={u.id}
                    {...listItemEntry(i, reducedMotion)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-ink-750"
                  >
                    <UserAvatar user={u} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.display_name}</p>
                      <p className="truncate text-xs text-muted">@{u.username}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => addContact(u)}
                    >
                      <UserPlus size={14} />
                      {t('contacts.add')}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4">
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
                    <Button size="sm" variant="secondary" onPress={() => setTab('add')}>
                      <UserPlus size={14} />
                      {t('contacts.add')}
                    </Button>
                  )}
                </motion.div>
              ) : (
                listWithPresence.map((u, i) => (
                  <motion.div key={u.id} {...listItemEntry(i, reducedMotion)}>
                    <ContactCard
                      user={{ ...u, is_favorite: favorites.some((f) => targetIdOf(f) === targetIdOf(u)) }}
                      type={tab === 'blocked' ? 'blocked' : 'contact'}
                      onRemove={tab === 'blocked' ? unblock : removeContact}
                      onToggleFavorite={toggleFavorite}
                      onMessage={messageContact}
                      messaging={messagingId === u.id}
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
