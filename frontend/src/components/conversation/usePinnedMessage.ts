import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@heroui/react';
import { messagesApi } from '@/lib/endpoints';
import type { ChatMessage } from '@/stores/chatStore';
import type { MessageResponse } from '@/types/message';

/**
 * El mensaje fijado de la conversación. Un chat sólo puede tener uno a la vez
 * (para todos los miembros): fijar otro reemplaza al anterior.
 */
export default function usePinnedMessage(conversationId: string | undefined) {
  const { t } = useTranslation();
  const [pinnedMessage, setPinnedMessage] = useState<MessageResponse | null>(null);

  // Load the conversation's single pinned message (if any) so the bar below
  // the header and the context menu's pin/unpin state stay in sync.
  useEffect(() => {
    setPinnedMessage(null);
    if (!conversationId) return undefined;
    let active = true;
    messagesApi.getPinned(conversationId)
      .then(({ data }) => {
        if (active) setPinnedMessage(data ?? null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [conversationId]);

  const handleTogglePin = useCallback(async (message: ChatMessage) => {
    if (!conversationId) return;
    const isPinned = pinnedMessage?.id === message.id;
    const previous = pinnedMessage;
    setPinnedMessage(isPinned ? null : message);
    try {
      if (isPinned) {
        await messagesApi.unpin(conversationId, message.id);
        toast.success(t('chat.unpinnedToast'));
      } else {
        await messagesApi.pin(conversationId, message.id);
        toast.success(t('chat.pinnedToast'));
      }
    } catch {
      setPinnedMessage(previous); // revert on failure
    }
  }, [conversationId, pinnedMessage, t]);

  const handleUnpinBar = useCallback(async () => {
    if (!conversationId || !pinnedMessage) return;
    const previous = pinnedMessage;
    setPinnedMessage(null);
    try {
      await messagesApi.unpin(conversationId, previous.id);
      toast.success(t('chat.unpinnedToast'));
    } catch {
      setPinnedMessage(previous); // revert on failure
    }
  }, [conversationId, pinnedMessage, t]);

  return { pinnedMessage, handleTogglePin, handleUnpinBar };
}
