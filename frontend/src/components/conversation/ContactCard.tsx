import { useEffect, useState } from 'react';
import { Button, toast } from '@heroui/react';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import { usersApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';
import type { UserResponse } from '@/types/user';

// Un mismo contacto puede aparecer en varios mensajes: se pide una vez por sesión.
const userCache = new Map<string, Promise<UserResponse | null>>();

function loadUser(id: string) {
  let p = userCache.get(id);
  if (!p) {
    p = usersApi.getById(id).then((r) => r.data).catch(() => null);
    userCache.set(id, p);
  }
  return p;
}

/**
 * Tarjeta de un contacto compartido. El mensaje sólo guarda el id: nombre,
 * puesto y avatar se leen del usuario, así siempre están al día.
 */
export default function ContactCard({ userId, fallbackName, currentUserId, variant }: {
  userId: string;
  fallbackName?: string | null;
  currentUserId?: string;
  variant: 'own' | 'other';
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createConversation = useChatStore((s) => s.createConversation);
  const [user, setUser] = useState<UserResponse | null | undefined>(undefined);
  const [opening, setOpening] = useState(false);
  const isOwn = variant === 'own';

  useEffect(() => {
    let alive = true;
    void loadUser(userId).then((u) => { if (alive) setUser(u); });
    return () => { alive = false; };
  }, [userId]);

  const name = user?.display_name || user?.username || fallbackName || t('contactShare.unknown');
  const subtitle = user ? [user.job_title, user.department].filter(Boolean).join(' · ') || `@${user.username}` : null;
  const canMessage = !!user && user.id !== currentUserId && user.status !== 'deleted';

  const openChat = async () => {
    setOpening(true);
    try {
      const conv = await createConversation({ type: 'direct', member_ids: [userId] });
      void navigate(`/chat/${conv.id}`);
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('contacts.messageError'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className={`flex w-64 max-w-[70vw] flex-col gap-2 rounded-lg p-2.5 ${isOwn ? 'bg-black/15' : 'bg-ink-800/70'}`}>
      <div className="flex items-center gap-2.5">
        <UserAvatar user={user ?? { display_name: name }} size="md" />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[14px] font-semibold ${isOwn ? 'text-white' : 'text-foreground'}`}>{name}</p>
          {subtitle && <p className={`truncate text-[11px] ${isOwn ? 'text-white/75' : 'text-ink-200'}`}>{subtitle}</p>}
        </div>
      </div>
      {canMessage && (
        <Button
          size="sm"
          variant={isOwn ? 'ghost' : 'secondary'}
          isPending={opening}
          onPress={() => void openChat()}
          className={`gap-1.5 ${isOwn ? 'bg-white/15 text-white hover:bg-white/25' : ''}`}
        >
          <MessageCircle size={14} /> {t('contactShare.message')}
        </Button>
      )}
    </div>
  );
}
