import { useState, useEffect } from 'react';
import { Modal, Spinner } from '@heroui/react';
import { Info, Check, CheckCheck, Send, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { messagesApi } from '@/lib/endpoints';
import { formatFullTime } from '@/lib/dates';

/* ─────────────────────────────────────────────────────────
   MessageInfoModal — "Información del mensaje": cuándo se
   envió y, por destinatario, cuándo se entregó y se leyó.
   ───────────────────────────────────────────────────────── */
export default function MessageInfoModal({ message, isOpen, onClose }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !message?.id) return;
    let cancelled = false;
    setLoading(true);
    setInfo(null);
    messagesApi
      .getInfo(message.id)
      .then((res) => { if (!cancelled) setInfo(res.data); })
      .catch(() => { if (!cancelled) setInfo(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, message?.id]);

  const handleOpenChange = (open) => { if (!open) onClose(); };

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
                    <div className="flex flex-col gap-3">
                      {receipts.map((r) => (
                        <div key={r.user_id} className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-foreground">
                            {r.display_name || r.username}
                          </span>
                          {r.read_at ? (
                            <Row
                              compact
                              icon={<CheckCheck size={14} className="text-sky-400" />}
                              label={t('chat.read')}
                              time={formatFullTime(r.read_at)}
                            />
                          ) : r.delivered_at ? (
                            <Row
                              compact
                              icon={<CheckCheck size={14} className="text-ink-200" />}
                              label={t('chat.delivered')}
                              time={formatFullTime(r.delivered_at)}
                            />
                          ) : (
                            <Row
                              compact
                              icon={<Check size={14} className="text-ink-300" />}
                              label={t('chat.pendingDelivery')}
                              time=""
                            />
                          )}
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

function Row({ icon, label, time, compact = false }) {
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
