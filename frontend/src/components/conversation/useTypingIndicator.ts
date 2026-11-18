import { useRef, useLayoutEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/stores/chatStore';

/**
 * "Fulano está escribiendo…" de la conversación y emisión del propio estado de
 * escritura (se apaga solo tras 2 s sin teclear o al salir del chat).
 */
export default function useTypingIndicator(conversationId: string | undefined, currentUserId: string | undefined) {
  const { t } = useTranslation();
  const typingUsers = useChatStore((s) => s.typingUsers);
  const emitTyping = useChatStore((s) => s.emitTyping);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    return () => {
      if (conversationId) emitTyping(conversationId, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, emitTyping]);

  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    emitTyping(conversationId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(conversationId, false);
    }, 2000);
  }, [conversationId, emitTyping]);

  const stopTyping = useCallback(() => {
    if (!conversationId) return;
    emitTyping(conversationId, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [conversationId, emitTyping]);

  const currentTyping = (conversationId ? typingUsers[conversationId] : null) || {};
  const typingNames = Object.entries(currentTyping)
    .filter(([uid]) => uid !== currentUserId)
    .map(([, name]) => name);
  const typingText =
    typingNames.length === 1
      ? t('chat.isTyping', { name: typingNames[0] })
      : typingNames.length > 1
        ? t('chat.areTyping', { names: typingNames.join(', ') })
        : null;

  return { typingText, notifyTyping, stopTyping };
}
