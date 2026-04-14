import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button, Input, Tooltip } from '@heroui/react';
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
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-default ${
        isActive ? 'bg-default' : ''
      }`}
    >
      <div className="relative shrink-0">
        {isDirect ? (
          <UserAvatar
            user={{ display_name: name, presence: conversation.member_presence }}
            showStatus
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
            <Hash size={18} className="text-accent" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>
            {name}
          </span>
          {time && (
            <span className="ml-2 shrink-0 text-xs text-muted">
              {formatMessageTime(time)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="truncate text-xs text-muted">{lastMsg || '\u00A0'}</p>
          {unread > 0 && (
            <span className="ml-2 shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
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
    <div className="flex h-full w-80 flex-col border-r border-separator bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-separator px-4 py-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} showStatus size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.display_name}</p>
            <p className="truncate text-xs text-muted">@{user?.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat/new')}>
              <Plus size={18} />
            </Button>
            <Tooltip.Content>
              <p>Nuevo chat</p>
            </Tooltip.Content>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <div className="relative px-3 py-2">
        <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <Input
          placeholder="Buscar conversación..."
          className="bg-default pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted">
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
      <div className="flex items-center justify-around border-t border-separator px-2 py-2">
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/chat')}>
            <MessageSquare size={18} />
          </Button>
          <Tooltip.Content><p>Chats</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/contacts')}>
            <Users size={18} />
          </Button>
          <Tooltip.Content><p>Contactos</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/notifications')}>
            <Bell size={18} />
          </Button>
          <Tooltip.Content><p>Notificaciones</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => navigate('/settings')}>
            <Settings size={18} />
          </Button>
          <Tooltip.Content><p>Configuración</p></Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="danger" onPress={handleLogout}>
            <LogOut size={18} />
          </Button>
          <Tooltip.Content><p>Cerrar sesión</p></Tooltip.Content>
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
