import { useRef, useEffect, useCallback } from 'react';
import { messagesApi } from '@/lib/endpoints';

/**
 * Borrador del composer por conversación: lo carga al entrar y lo guarda con
 * debounce mientras se escribe (no mientras se edita un mensaje).
 */
export default function useConversationDraft(
  conversationId: string | undefined,
  input: string,
  setInput: (value: string) => void,
  isEditing: boolean,
) {
  const draftReadyRef = useRef(false); // true once the draft for this conv has loaded
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the saved draft when switching conversations
  useEffect(() => {
    if (!conversationId) return;
    draftReadyRef.current = false;
    let active = true;
    setInput('');
    void (async () => {
      try {
        const { data } = await messagesApi.getDraft(conversationId);
        if (active && data?.body) setInput(data.body);
      } catch {
        // no draft / ignore
      } finally {
        if (active) draftReadyRef.current = true;
      }
    })();
    return () => { active = false; };
  }, [conversationId, setInput]);

  // Debounced autosave of the draft as the user types (skipped while editing)
  useEffect(() => {
    if (!conversationId || !draftReadyRef.current || isEditing) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      const body = (input ?? '').trim();
      if (body) {
        messagesApi.saveDraft(conversationId, { body }).catch(() => {});
      } else {
        messagesApi.deleteDraft(conversationId).catch(() => {});
      }
    }, 600);
    return () => { if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current); };
  }, [input, conversationId, isEditing]);

  // El mensaje ya salió (enviado o programado): descartar el borrador guardado.
  const discardDraft = useCallback(() => {
    if (!conversationId) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    messagesApi.deleteDraft(conversationId).catch(() => {});
  }, [conversationId]);

  return { discardDraft };
}
