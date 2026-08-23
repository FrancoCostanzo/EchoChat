import { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Input, Spinner, toast } from '@heroui/react';
import { CalendarClock, Trash2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { scheduledApi } from '@/lib/endpoints';
import { formatFullTime } from '@/lib/dates';
import type { ScheduledMessageResponse } from '@/types/scheduled';

/* ─────────────────────────────────────────────────────────
   Programar un mensaje: se escribe ahora y sale a la hora
   elegida (job `scheduled-messages`, un tick por minuto).
   El modal también lista lo pendiente de esta conversación,
   que es el único lugar donde se puede cancelar.
   ───────────────────────────────────────────────────────── */

/** <input type="datetime-local"> quiere "YYYY-MM-DDTHH:mm" en hora local. */
function paraInput(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Sugerencia inicial: mañana a las 9. */
function sugerenciaInicial(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return paraInput(d);
}

interface ScheduleMessageModalProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Texto que hay en el composer al abrir. */
  initialBody?: string;
  /** Se llama tras programar, para que el composer se vacíe. */
  onScheduled?: () => void;
}

export default function ScheduleMessageModal({
  conversationId,
  isOpen,
  onClose,
  initialBody = '',
  onScheduled,
}: ScheduleMessageModalProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState(initialBody);
  const [cuando, setCuando] = useState(sugerenciaInicial);
  const [busy, setBusy] = useState(false);
  // La validación se calcula al cambiar la fecha, no en el render: leer el reloj
  // mientras se pinta es impuro (y el linter lo marca).
  const [enElPasado, setEnElPasado] = useState(false);
  const [pendientes, setPendientes] = useState<ScheduledMessageResponse[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargarPendientes = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await scheduledApi.listScheduled();
      setPendientes(
        (data || []).filter((m) => m.conversation_id === conversationId && m.status === 'pending'),
      );
    } catch {
      setPendientes([]);
    } finally {
      setCargando(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!isOpen) return;
    setBody(initialBody);
    setCuando(sugerenciaInicial());
    setEnElPasado(false);
    void cargarPendientes();
  }, [isOpen, initialBody, cargarPendientes]);

  const cambiarCuando = (valor: string) => {
    setCuando(valor);
    setEnElPasado(!!valor && new Date(valor).getTime() <= Date.now());
  };

  const puedeEnviar = body.trim().length > 0 && !!cuando && !enElPasado;

  const programar = async () => {
    if (!puedeEnviar || busy) return;
    setBusy(true);
    try {
      await scheduledApi.schedule({
        conversation_id: conversationId,
        body: body.trim(),
        scheduled_at: new Date(cuando).toISOString(),
      });
      toast.success(t('schedule.scheduled'));
      onScheduled?.();
      onClose();
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async (id: string) => {
    try {
      await scheduledApi.cancelScheduled(id);
      setPendientes((prev) => prev.filter((m) => m.id !== id));
      toast.success(t('schedule.cancelled'));
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <CalendarClock size={16} /> {t('schedule.title')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-200">{t('schedule.message')}</label>
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('schedule.messagePlaceholder')}
                  maxLength={10000}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-200">{t('schedule.when')}</label>
                <Input type="datetime-local" value={cuando} onChange={(e) => cambiarCuando(e.target.value)} />
                {enElPasado && (
                  <span className="flex items-center gap-1 text-xs text-danger">
                    <AlertCircle size={12} /> {t('schedule.pastDate')}
                  </span>
                )}
              </div>

              {(cargando || pendientes.length > 0) && (
                <div className="flex flex-col gap-1.5 border-t border-(--panel-border) pt-3">
                  <span className="text-xs font-medium text-ink-200">{t('schedule.pending')}</span>
                  {cargando ? (
                    <Spinner size="sm" />
                  ) : (
                    pendientes.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] text-foreground">{m.body}</p>
                          <p className="text-[11px] text-ink-200">{formatFullTime(m.scheduled_at)}</p>
                        </div>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-label={t('schedule.cancel')}
                          onPress={() => cancelar(m.id)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button className="w-full" isDisabled={!puedeEnviar} isPending={busy} onPress={programar}>
                {t('schedule.submit')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
