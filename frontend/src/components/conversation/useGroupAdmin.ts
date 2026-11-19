import { useState, useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@heroui/react';
import { useChatStore } from '@/stores/chatStore';
import { conversationsApi } from '@/lib/endpoints';

/**
 * Edición de un grupo/canal: foto (con recorte), nombre/descripción y permisos.
 * Quién puede hacerlo lo decide la página; el backend lo vuelve a chequear.
 */
export default function useGroupAdmin(conversationId: string | undefined) {
  const { t } = useTranslation();
  const patchConversation = useChatStore((s) => s.patchConversation);
  const [groupAvatarSrc, setGroupAvatarSrc] = useState<string | null>(null);
  const [groupAvatarName, setGroupAvatarName] = useState('avatar.jpg');
  const [groupAvatarLoading, setGroupAvatarLoading] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  const handleGroupAvatarPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    setGroupAvatarName(file.name);
    setGroupAvatarSrc(URL.createObjectURL(file));
  };

  const handleGroupAvatarConfirm = async (file: File) => {
    if (!conversationId) return;
    setGroupAvatarLoading(true);
    try {
      const { data } = await conversationsApi.uploadAvatar(conversationId, file);
      patchConversation(conversationId, { avatar_url: data.avatar_url, avatar_object_id: data.avatar_object_id });
      toast.success(t('chat.groupPhotoUpdated'));
      setGroupAvatarSrc(null);
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
    } finally {
      setGroupAvatarLoading(false);
    }
  };

  const handleGroupAvatarRemove = async () => {
    if (!conversationId) return;
    try {
      await conversationsApi.removeAvatar(conversationId);
      patchConversation(conversationId, { avatar_url: null, avatar_object_id: null });
      toast.success(t('chat.groupPhotoRemoved'));
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
    }
  };

  const handleUpdateGroupInfo = async (patch: { name?: string; description?: string | null }) => {
    if (!conversationId) return;
    try {
      const { data } = await conversationsApi.update(conversationId, patch);
      patchConversation(conversationId, { name: data.name, description: data.description });
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
      throw err;
    }
  };

  const handleUpdateGroupPermissions = async (patch: { is_read_only?: boolean; only_admins_edit_info?: boolean }) => {
    if (!conversationId) return;
    try {
      const { data } = await conversationsApi.update(conversationId, patch);
      patchConversation(conversationId, {
        is_read_only: data.is_read_only,
        only_admins_edit_info: data.only_admins_edit_info,
      });
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
      throw err;
    }
  };

  return {
    groupAvatarInputRef,
    groupAvatarSrc,
    groupAvatarName,
    groupAvatarLoading,
    closeGroupAvatarCrop: () => setGroupAvatarSrc(null),
    handleGroupAvatarPick,
    handleGroupAvatarConfirm,
    handleGroupAvatarRemove,
    handleUpdateGroupInfo,
    handleUpdateGroupPermissions,
  };
}
