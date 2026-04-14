import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Tabs, Tab, Checkbox, Card } from '@heroui/react';
import { Search, ArrowLeft, Users, User, Hash } from 'lucide-react';
import { usersApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';

export default function NewConversationPage() {
  const navigate = useNavigate();
  const createConversation = useChatStore((s) => s.createConversation);

  const [tab, setTab] = useState('direct');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setUsers([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const { data } = await usersApi.search(search);
        setUsers(data);
      } catch {
        setUsers([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const toggleUser = (userId) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const data =
        tab === 'direct'
          ? { type: 'direct', member_ids: [selected[0]] }
          : { type: 'group', name: groupName || 'Nuevo grupo', member_ids: selected };

      const conv = await createConversation(data);
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-divider px-4 py-3">
        <Button isIconOnly size="sm" variant="light" onPress={() => navigate('/chat')}>
          <ArrowLeft size={18} />
        </Button>
        <h2 className="text-base font-semibold">Nueva conversación</h2>
      </div>

      <div className="px-4 py-3">
        <Tabs selectedKey={tab} onSelectionChange={setTab} size="sm">
          <Tab
            key="direct"
            title={
              <div className="flex items-center gap-2">
                <User size={14} />
                <span>Directo</span>
              </div>
            }
          />
          <Tab
            key="group"
            title={
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span>Grupo</span>
              </div>
            }
          />
          <Tab
            key="channel"
            title={
              <div className="flex items-center gap-2">
                <Hash size={14} />
                <span>Canal</span>
              </div>
            }
          />
        </Tabs>
      </div>

      {tab !== 'direct' && (
        <div className="px-4 pb-2">
          <Input
            label="Nombre del grupo/canal"
            placeholder="Ej: Equipo de desarrollo"
            size="sm"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
      )}

      <div className="px-4 pb-2">
        <Input
          placeholder="Buscar usuarios..."
          size="sm"
          startContent={<Search size={16} className="text-default-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-2">
          {selected.map((id) => {
            const u = users.find((usr) => usr.id === id);
            return u ? (
              <Button key={id} size="sm" variant="flat" onPress={() => toggleUser(id)}>
                {u.display_name} ✕
              </Button>
            ) : null;
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              if (tab === 'direct') {
                setSelected([u.id]);
              } else {
                toggleUser(u.id);
              }
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-default-100"
          >
            {tab !== 'direct' && (
              <Checkbox isSelected={selected.includes(u.id)} size="sm" />
            )}
            <UserAvatar user={u} showStatus size="sm" />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium">{u.display_name}</p>
              <p className="truncate text-xs text-default-500">@{u.username}</p>
            </div>
            {u.department && (
              <span className="text-xs text-default-400">{u.department}</span>
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-divider px-4 py-3">
        <Button
          color="primary"
          className="w-full"
          isDisabled={selected.length === 0}
          isLoading={loading}
          onPress={handleCreate}
        >
          {tab === 'direct'
            ? 'Iniciar conversación'
            : `Crear ${tab === 'group' ? 'grupo' : 'canal'} (${selected.length})`}
        </Button>
      </div>
    </div>
  );
}
