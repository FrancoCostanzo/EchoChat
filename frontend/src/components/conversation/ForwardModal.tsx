import { useState } from 'react';
import { Button, Input, Modal } from '@heroui/react';
import { Search, Forward, Hash, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import { messagesApi } from '@/lib/endpoints';
import type { ChatMessage } from '@/stores/chatStore';
import type { ConversationResponse } from '@/types/conversation';

/* ─────────────────────────────────────────────────────────
   ForwardModal — pick target conversations to forward a message
   ───────────────────────────────────────────────────────── */
export default function ForwardModal({
  message,
  conversations,
  currentConvId,
  isOpen,
  onClose,
}: {
  message: ChatMessage | null;
  conversations: ConversationResponse[];
  currentConvId?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setSelected([]);
      setSearch('');
    }
  };

  const query = search.trim().toLowerCase();
  const targets = conversations.filter((c) => {
    if (c.id === currentConvId) return false;
    if (!query) return true;
    return (c.display_name || c.name || '').toLowerCase().includes(query);
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleForward = async () => {
    if (selected.length === 0 || !message) return;
    setSending(true);
    try {
      await messagesApi.forward(message.id, selected);
      onClose();
      setSelected([]);
      setSearch('');
    } catch {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <Forward size={16} /> {t('chat.forwardTo')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-200" />
                <Input className="pl-9" placeholder={t('sidebar.searchConversation')} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>

              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                {targets.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-200">{t('sidebar.noConversations')}</p>
                ) : targets.map((c) => {
                  const name = c.display_name || c.name || t('sidebar.noName');
                  const isSel = selected.includes(c.id);
                  return (
                    <Button
                      key={c.id}
                      variant="ghost"
                      onPress={() => toggle(c.id)}
                      className={`flex h-auto w-full items-center justify-start gap-3 rounded-md px-2 py-2 text-left transition-colors ${isSel ? 'bg-accent/15 echo-ring-soft' : 'hover:bg-ink-750'}`}
                    >
                      {c.type === 'direct' ? (
                        <UserAvatar user={{ display_name: name, avatar_url: c.other_avatar_url }} size="sm" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-ink-100"><Hash size={15} /></div>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                      {isSel && <Check size={16} className="text-accent" />}
                    </Button>
                  );
                })}
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button className="w-full" isDisabled={selected.length === 0} isPending={sending} onPress={handleForward}>
                {t('chat.forward')}{selected.length > 0 ? ` (${selected.length})` : ''}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
