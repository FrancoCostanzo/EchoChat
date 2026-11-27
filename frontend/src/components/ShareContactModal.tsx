import { useEffect, useState } from 'react';
import { Modal, Input, ScrollShadow, Spinner } from '@heroui/react';
import { Contact, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import { usersApi } from '@/lib/endpoints';
import type { UserResponse } from '@/types/user';

interface ShareContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (user: UserResponse) => void;
}

/** Busca un usuario de la organización y lo manda como tarjeta de contacto. */
export default function ShareContactModal({ isOpen, onClose, onSend }: ShareContactModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!isOpen || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      usersApi.search(q, 20)
        .then((res) => { if (!cancelled) setResults(res.data); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setQuery('');
      setResults([]);
    }
  };

  const pick = (user: UserResponse) => {
    onSend(user);
    onClose();
    setQuery('');
    setResults([]);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <Contact size={16} /> {t('contactShare.title')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
                <Input
                  className="w-full pl-8"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('contactShare.searchPlaceholder')}
                  autoFocus
                />
              </div>
              <ScrollShadow className="max-h-72">
                {loading && (
                  <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                )}
                {!loading && query.trim().length >= 2 && results.length === 0 && (
                  <p className="py-4 text-center text-sm text-ink-200">{t('contactShare.noResults')}</p>
                )}
                {!loading && results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => pick(u)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-ink-750"
                  >
                    <UserAvatar user={u} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{u.display_name || u.username}</p>
                      <p className="truncate text-[11px] text-ink-300">
                        {[u.job_title, u.department].filter(Boolean).join(' · ') || `@${u.username}`}
                      </p>
                    </div>
                  </button>
                ))}
              </ScrollShadow>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
