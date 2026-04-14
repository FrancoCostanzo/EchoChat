import { useState, useEffect } from 'react';
import { Input, Button, Tabs, Spinner } from '@heroui/react';
import {
  Search,
  UserPlus,
  Star,
  Ban,
  Trash2,
  StarOff,
} from 'lucide-react';
import { relationshipsApi, usersApi } from '@/lib/endpoints';
import UserAvatar from '@/components/UserAvatar';

function ContactCard({ user, type, onRemove, onToggleFavorite }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-default">
      <UserAvatar user={user} showStatus size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.display_name || user.username}</p>
        {user.department && (
          <p className="truncate text-xs text-muted">{user.department}</p>
        )}
      </div>
      <div className="flex gap-1">
        {type === 'contact' && (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => onToggleFavorite(user)}
            aria-label={user.is_favorite ? 'Quitar favorito' : 'Agregar a favoritos'}
          >
            {user.is_favorite ? <StarOff size={16} /> : <Star size={16} />}
          </Button>
        )}
        <Button
          isIconOnly
          size="sm"
          variant="danger"
          onPress={() => onRemove(user)}
        >
          {type === 'blocked' ? <Ban size={16} /> : <Trash2 size={16} />}
        </Button>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [tab, setTab] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const addContact = async (user) => {
    await relationshipsApi.create({ target_user_id: user.id, type: 'contact' });
    fetchAll();
  };

  const removeContact = async (user) => {
    await relationshipsApi.remove(user.id, 'contact');
    fetchAll();
  };

  const toggleFavorite = async (user) => {
    const isFav = favorites.some((f) => f.id === user.id);
    if (isFav) {
      await relationshipsApi.remove(user.id, 'favorite');
    } else {
      await relationshipsApi.create({ target_user_id: user.id, type: 'favorite' });
    }
    fetchAll();
  };

  const unblock = async (user) => {
    await relationshipsApi.remove(user.id, 'blocked');
    fetchAll();
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-separator px-4 py-3">
        <h2 className="text-base font-semibold">Contactos</h2>
      </div>

      <div className="px-4 py-3">
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <Tabs.List aria-label="Secciones de contactos">
            <Tabs.Tab id="contacts">{`Contactos (${contacts.length})`}</Tabs.Tab>
            <Tabs.Tab id="favorites">{`Favoritos (${favorites.length})`}</Tabs.Tab>
            <Tabs.Tab id="blocked">{`Bloqueados (${blocked.length})`}</Tabs.Tab>
            <Tabs.Tab id="add">Agregar</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </div>

      {tab === 'add' ? (
        <div className="flex flex-1 flex-col px-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <Input
              placeholder="Buscar usuarios para agregar..."
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
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-default">
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
                  Agregar
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4">
          {getList().length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted">
              <p className="text-sm">
                {tab === 'contacts' && 'No tenés contactos aún'}
                {tab === 'favorites' && 'No tenés favoritos aún'}
                {tab === 'blocked' && 'No tenés usuarios bloqueados'}
              </p>
            </div>
          ) : (
            getList().map((u) => (
              <ContactCard
                key={u.id}
                user={u}
                type={tab === 'blocked' ? 'blocked' : 'contact'}
                onRemove={tab === 'blocked' ? unblock : removeContact}
                onToggleFavorite={toggleFavorite}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
