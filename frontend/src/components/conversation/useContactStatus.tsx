import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@heroui/react';
import { UserPlus } from 'lucide-react';
import { relationshipsApi } from '@/lib/endpoints';

/**
 * Si el otro usuario de un DM ya está en mis contactos, y la acción para
 * agregarlo. `isContact` es `null` mientras no se sabe (o fuera de un DM).
 */
export default function useContactStatus(otherUserId: string | null | undefined, displayName: string | null | undefined) {
  const { t } = useTranslation();
  const [isContact, setIsContact] = useState<boolean | null>(null);
  const [addingContact, setAddingContact] = useState(false);

  // Check whether the DM peer is already in contacts (only for direct chats).
  useEffect(() => {
    if (!otherUserId) {
      setIsContact(null);
      return undefined;
    }
    let alive = true;
    setIsContact(null);
    relationshipsApi.getContacts()
      .then(({ data }) => {
        if (!alive) return;
        const found = (data || []).some(
          (c) => (c.target_user_id || c.id) === otherUserId,
        );
        setIsContact(found);
      })
      .catch(() => {
        if (alive) setIsContact(false);
      });
    return () => { alive = false; };
  }, [otherUserId]);

  const handleAddContact = useCallback(async () => {
    if (!otherUserId || addingContact) return;
    setAddingContact(true);
    try {
      await relationshipsApi.create({ target_user_id: otherUserId, type: 'contact' });
      setIsContact(true);
      toast.success(t('contacts.addedToast', {
        name: displayName || t('chat.conversation'),
      }), {
        indicator: <UserPlus size={16} />,
      });
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('contacts.addError'));
    } finally {
      setAddingContact(false);
    }
  }, [otherUserId, addingContact, displayName, t]);

  return { isContact, addingContact, handleAddContact };
}
