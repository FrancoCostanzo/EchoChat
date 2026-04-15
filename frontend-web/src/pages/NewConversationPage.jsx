import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Tabs, Checkbox, Spinner } from '@heroui/react';
import { Search, ArrowLeft, Users, User, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usersApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';

export default function NewConversationPage() {
  const { t } = useTranslation();
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
          : { type: 'group', name: groupName || t('newConversation.group'), member_ids: selected };

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
      <div className="flex items-center gap-3 border-b border-separator px-4 py-3">
        <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
          <ArrowLeft size={18} />
        </Button>
        <h2 className="text-base font-semibold">{t('newConversation.title')}</h2>
      </div>

      <div className="px-4 py-3">
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <Tabs.List aria-label={t('newConversation.conversationType')}>
            <Tabs.Tab id="direct">
              <User size={14} />
              <span>{t('newConversation.direct')}</span>
            </Tabs.Tab>
            <Tabs.Tab id="group">
              <Users size={14} />
              <span>{t('newConversation.group')}</span>
            </Tabs.Tab>
            <Tabs.Tab id="channel">
              <Hash size={14} />
              <span>{t('newConversation.channel')}</span>
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </div>

      {tab !== 'direct' && (
        <div className="flex flex-col gap-1 px-4 pb-2">
          <label className="text-sm text-muted">{t('newConversation.groupChannelName')}</label>
          <Input
            placeholder={t('newConversation.groupNamePlaceholder')}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
      )}

      <div className="relative px-4 pb-2">
        <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <Input
          placeholder={t('newConversation.searchUsers')}
          className="pl-9"
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
              <Button key={id} size="sm" variant="secondary" onPress={() => toggleUser(id)}>
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
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-default"
          >
            {tab !== 'direct' && (
              <Checkbox isSelected={selected.includes(u.id)}>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox>
            )}
            <UserAvatar user={u} showStatus size="sm" />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium">{u.display_name}</p>
              <p className="truncate text-xs text-muted">@{u.username}</p>
            </div>
            {u.department && (
              <span className="text-xs text-muted">{u.department}</span>
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-separator px-4 py-3">
        <Button
          className="w-full"
          isDisabled={selected.length === 0}
          isPending={loading}
          onPress={handleCreate}
        >
          {({ isPending }) =>
            isPending ? (
              <><Spinner size="sm" color="current" /> {t('chat.creating')}</>
            ) : tab === 'direct'
              ? t('newConversation.startConversation')
              : tab === 'group'
                ? t('newConversation.createGroup', { count: selected.length })
                : t('newConversation.createChannel', { count: selected.length })
          }
        </Button>
      </div>
    </div>
  );
}
