import { useState, useEffect, type ReactNode } from 'react';
import { Modal, Spinner } from '@heroui/react';
import { Info, Check, CheckCheck, Send, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { messagesApi } from '@/lib/endpoints';
import { formatFullTime } from '@/lib/dates';
import UserAvatar from '@/components/UserAvatar';

/**
 * Forma de /messages/:id/info — sin model.ts propio en el backend (ver la
 * nota en types/broadcast.ts), inferida de este mismo componente.
 */
interface MessageReceipt {
  user_id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
}

interface MessageInfo {
  sender_id: string;
  sent_at: string | null;
  is_edited?: boolean;
  edited_at?: string | null;
  receipts: MessageReceipt[];
}

interface MessageInfoModalProps {
  message?: { id?: string } | null;
  isOpen: boolean;
  onClose: () => void;
}

/* ─────────────────────────────────────────────────────────
   MessageInfoModal — "Información del mensaje": cuándo se
   envió y, por destinatario, cuándo se entregó y se leyó.
   ───────────────────────────────────────────────────────── */
export default function MessageInfoModal({ message, isOpen, onClose }: MessageInfoModalProps) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<MessageInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !message?.id) return;
    let cancelled = false;
    setLoading(true);
    setInfo(null);
    messagesApi
      .getInfo(message.id)
      .then((res) => { if (!cancelled) setInfo(res.data as MessageInfo); })
      .catch(() => { if (!cancelled) setInfo(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, message?.id]);

  const handleOpenChange = (open: boolean) => { if (!open) onClose(); };

  // En DMs/grupos el emisor no recibe recibo de sí mismo.
  const receipts = (info?.receipts || []).filter((r) => r.user_id !== info?.sender_id);

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <Info size={16} /> {t('chat.messageInfo')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4 pb-4">
              {loading && (
                <div className="flex justify-center py-6"><Spinner size="md" /></div>
              )}

              {!loading && info && (
                <>
                  {/* Enviado */}
                  <Row
                    icon={<Send size={15} className="text-ink-100" />}
                    label={t('chat.sent')}
                    time={formatFullTime(info.sent_at)}
                  />
                  {info.is_edited && info.edited_at && (
                    <Row
                      icon={<Clock size={15} className="text-ink-100" />}
                      label={t('chat.editedAt')}
                      time={formatFullTime(info.edited_at)}
                    />
                  )}

                  {/* Destinatarios */}
                  <div className="h-px bg-white/10" />
                  {receipts.length === 0 ? (
                    <p className="py-2 text-center text-sm text-ink-200">{t('chat.noReceiptsYet')}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {receipts.map((r) => (
                        <div key={r.user_id} className="flex items-center gap-3 rounded-lg bg-ink-800/50 px-3 py-2.5">
                          <UserAvatar
                            user={{ display_name: r.display_name, username: r.username, avatar_url: r.avatar_url }}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {r.display_name || r.username}
                            </p>
                            <p className="truncate text-[11px] text-ink-300">
                              @{r.username}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {/* Entregado: visible apenas hay delivered_at o read_at */}
                            {(r.delivered_at || r.read_at) && (
                              <span className="flex items-center gap-1.5">
                                <CheckCheck size={13} className="text-ink-300" />
                                <span className="text-[11px] tabular-nums text-ink-200">
                                  {formatFullTime(r.delivered_at || r.read_at)}
                                </span>
                              </span>
                            )}
                            {/* Visto */}
                            {r.read_at ? (
                              <span className="flex items-center gap-1.5">
                                <CheckCheck size={13} className="text-sky-400" />
                                <span className="text-[11px] tabular-nums text-sky-400">
                                  {formatFullTime(r.read_at)}
                                </span>
                              </span>
                            ) : !r.delivered_at ? (
                              <span className="flex items-center gap-1.5">
                                <Check size={13} className="text-ink-400" />
                                <span className="text-[11px] text-ink-400">{t('chat.pendingDelivery')}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!loading && !info && (
                <p className="py-4 text-center text-sm text-ink-200">{t('chat.infoUnavailable')}</p>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

interface RowProps {
  icon: ReactNode;
  label: string;
  time?: string;
  compact?: boolean;
}

function Row({ icon, label, time, compact = false }: RowProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${compact ? 'pl-1' : ''}`}>
      <span className="flex items-center gap-2 text-sm text-ink-100">
        {icon}
        {label}
      </span>
      {time && <span className="text-xs text-ink-200">{time}</span>}
    </div>
  );
}
