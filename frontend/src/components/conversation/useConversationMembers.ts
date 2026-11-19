import { useState, useEffect, useMemo } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { conversationsApi } from '@/lib/endpoints';
import type { ConversationResponse, MemberResponse } from '@/types/conversation';

/**
 * Miembros de un grupo/canal (en DMs queda vacío) con la presencia en vivo del
 * socket superpuesta, para que el panel no quede desactualizado.
 */
export default function useConversationMembers(
  conversationId: string | undefined,
  conversation: ConversationResponse | undefined,
  isDirect: boolean,
) {
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const onlineUsers = useChatStore((s) => s.onlineUsers);

  useEffect(() => {
    if (!conversationId || !conversation || isDirect) {
      setMembers([]);
      return undefined;
    }
    let active = true;
    setLoadingMembers(true);
    conversationsApi
      .getMembers(conversationId)
      .then(({ data }) => { if (active) setMembers(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setMembers([]); })
      .finally(() => { if (active) setLoadingMembers(false); });
    return () => { active = false; };
  }, [conversationId, conversation, isDirect]);

  // Members are fetched once via REST; overlay live presence from the socket
  // so the member panel doesn't go stale while the conversation stays open.
  const membersWithPresence = useMemo(
    () => members.map((m) => ({ ...m, presence: onlineUsers[m.user_id] ?? m.presence })),
    [members, onlineUsers],
  );

  return { members, membersWithPresence, loadingMembers };
}
