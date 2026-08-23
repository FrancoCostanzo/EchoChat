import { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Input, toast } from '@heroui/react';
import { AlarmClock, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { scheduledApi } from '@/lib/endpoints';
import { formatFullTime } from '@/lib/dates';
import type { ReminderResponse } from '@/types/scheduled';

/* ─────────────────────────────────────────────────────────
   "Recordarme este mensaje": el aviso llega como notificación
   in-app cuando vence (job `scheduled-messages`).
   ───────────────────────────────────────────────────────── */

function paraInput(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Los atajos cubren el 90% de los casos; el resto va por fecha exacta. */
function atajos(): { clave: string; fecha: Date }[] {
  const enUnaHora = new Date(Date.now() + 60 * 60 * 1000);

  const estaTarde = new Date();
  estaTarde.setHours(18, 0, 0, 0);

  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(9, 0, 0, 0);

  const proximaSemana = new Date();
  proximaSemana.setDate(proximaSemana.getDate() + 7);
  proximaSemana.setHours(9, 0, 0, 0);

  return [
    { clave: 'inOneHour', fecha: enUnaHora },
    // Si ya pasaron las 18, "esta tarde" no tiene sentido: se filtra abajo.
    { clave: 'thisEvening', fecha: estaTarde },
    { clave: 'tomorrow', fecha: manana },
    { clave: 'nextWeek', fecha: proximaSemana },
  ].filter((a) => a.fecha.getTime() > Date.now());
}

interface RemindMeModalProps {
  messageId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function RemindMeModal({ messageId, isOpen, onClose }: RemindMeModalProps) {
  const { t } = useTranslation();
  const [cuando, setCuando] = useState('');
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);
  const [existentes, setExistentes] = useState<ReminderResponse[]>([]);
  // Atajos y validación se calculan al abrir / al tipear: leer el reloj durante
  // el render es impuro y además los recalcularía en cada pintada.
  const [listaAtajos, setListaAtajos] = useState<{ clave: string; fecha: Date }[]>([]);
  const [personalizadaValida, setPersonalizadaValida] = useState(false);
  const [minimo, setMinimo] = useState('');

  const cargar = useCallback(async () => {
    if (!messageId) return;
    try {
      const { data } = await scheduledApi.listReminders();
      setExistentes((data || []).filter((r) => r.message_id === messageId && r.status === 'pending'));
    } catch {
      setExistentes([]);
    }
  }, [messageId]);

  useEffect(() => {
    if (!isOpen) return;
    setCuando('');
    setNota('');
    setPersonalizadaValida(false);
    setListaAtajos(atajos());
    setMinimo(paraInput(new Date()));
    void cargar();
  }, [isOpen, cargar]);

  const crear = async (fecha: Date) => {
    if (!messageId || busy) return;
    setBusy(true);
    try {
      await scheduledApi.remind({
        message_id: messageId,
        remind_at: fecha.toISOString(),
        note: nota.trim() || null,
      });
      toast.success(t('remind.created'));
      onClose();
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async (id: string) => {
    try {
      await scheduledApi.cancelReminder(id);
      setExistentes((prev) => prev.filter((r) => r.id !== id));
      toast.success(t('remind.cancelled'));
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('common.error'));
    }
  };

  const cambiarCuando = (valor: string) => {
    setCuando(valor);
    setPersonalizadaValida(!!valor && new Date(valor).getTime() > Date.now());
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <AlarmClock size={16} /> {t('remind.title')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              {existentes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-200">{t('remind.existing')}</span>
                  {existentes.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-[13px]">{formatFullTime(r.remind_at)}</span>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={t('remind.cancel')}
                        onPress={() => cancelar(r.id)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-200">{t('remind.note')}</label>
                <Input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder={t('remind.notePlaceholder')}
                  maxLength={200}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-200">{t('remind.when')}</span>
                {listaAtajos.map(({ clave, fecha }) => (
                  <Button
                    key={clave}
                    variant="secondary"
                    isDisabled={busy}
                    className="justify-between"
                    onPress={() => crear(fecha)}
                  >
                    <span>{t(`remind.shortcuts.${clave}`)}</span>
                    <span className="text-xs opacity-70">{formatFullTime(fecha.toISOString())}</span>
                  </Button>
                ))}
              </div>

              <div className="flex flex-col gap-1 border-t border-(--panel-border) pt-3">
                <label className="text-xs font-medium text-ink-200">{t('remind.custom')}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    className="flex-1"
                    value={cuando}
                    min={minimo}
                    onChange={(e) => cambiarCuando(e.target.value)}
                  />
                  <Button
                    isDisabled={!personalizadaValida || busy}
                    onPress={() => crear(new Date(cuando))}
                  >
                    {t('remind.submit')}
                  </Button>
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
