import { AlertDialog, Button } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@/stores/chatStore';

/* ─────────────────────────── Confirm Delete Modal ─────────────────────────── */
export default function ConfirmDeleteModal({
  message,
  isOpen,
  onConfirm,
  onCancel,
}: {
  message: ChatMessage | null;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onCancel(); }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[400px]">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{t('chat.deleteMessage')}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <p className="text-pretty text-ink-100">
              {t('chat.deleteMessageWarning')}
            </p>
            {message?.body && message.type !== 'media' && (
              <div className="rounded-xl border border-ink-700/60 bg-ink-800/70 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-100 line-clamp-3">
                {message.body}
              </div>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onPress={onConfirm} autoFocus>
              <Trash2 size={14} />
              {t('common.delete')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
