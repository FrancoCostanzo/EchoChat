import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button, Input, Tooltip, Badge } from '@heroui/react';
import {
  MessageSquare,
  Users,
  Bell,
  Settings,
  LogOut,
  Search,
  Plus,
  Hash,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/dates';

function ConversationItem({ conversation, isActive, onClick }) {
  const isDirect = conversation.type === 'direct';
  const name = conversation.display_name || conversation.name || 'Sin nombre';
  const lastMsg = conversation.last_message_body;
  const time = conversation.last_message_at;
  const unread = conversation.unread_count || 0;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-default-100 ${
        isActive ? 'bg-default-100' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        {isDirect ? (
          <UserAvatar
            user={{ display_name: name, presence: conversation.member_presence }}
            showStatus
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Hash size={18} className="text-primary" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>
            {name}
          </span>
          {time && (
            <span className="ml-2 flex-shrink-0 text-xs text-default-400">
              {formatMessageTime(time)}
            </span>
          )}
        </div>
        {lastMsg && (
          <div className="flex items-center justify-between">
            <p className="truncate text-xs text-default-500">{lastMsg}</p>
            {unread > 0 && (
              <Badge color="primary" size="sm" className="ml-2">
                {unread}
              </Badge>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { conversations, activeConversationId, setActiveConversation } = useChatStore();
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => {
    const name = (c.display_name || c.name || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const handleConversationClick = useCallback(
    (id) => {
      setActiveConversation(id);
      navigate(`/chat/${id}`);
    },
    [setActiveConversation, navigate],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-full w-80 flex-col border-r border-divider bg-content1">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-divider px-4 py-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} showStatus size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.display_name}</p>
            <p className="truncate text-xs text-default-500">@{user?.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="Nuevo chat">
            <Button isIconOnly size="sm" variant="light" onPress={() => navigate('/chat/new')}>
              <Plus size={18} />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <Input
          placeholder="Buscar conversación..."
          size="sm"
          startContent={<Search size={16} className="text-default-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          classNames={{ inputWrapper: 'bg-default-100' }}
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-default-400">
            <MessageSquare size={32} />
            <p className="text-sm">Sin conversaciones</p>
          </div>
        )}
        {filtered.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeConversationId}
            onClick={() => handleConversationClick(conv.id)}
          />
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="flex items-center justify-around border-t border-divider px-2 py-2">
        <Tooltip content="Chats">
          <Button isIconOnly size="sm" variant="light" onPress={() => navigate('/chat')}>
            <MessageSquare size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="Contactos">
          <Button isIconOnly size="sm" variant="light" onPress={() => navigate('/contacts')}>
            <Users size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="Notificaciones">
          <Button isIconOnly size="sm" variant="light" onPress={() => navigate('/notifications')}>
            <Bell size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="Configuración">
          <Button isIconOnly size="sm" variant="light" onPress={() => navigate('/settings')}>
            <Settings size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="Cerrar sesión">
          <Button isIconOnly size="sm" variant="light" color="danger" onPress={handleLogout}>
            <LogOut size={18} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

export default function ChatLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
