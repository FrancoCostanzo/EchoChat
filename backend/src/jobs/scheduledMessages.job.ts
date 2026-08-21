import logger from '../config/logger';
import { scheduledService } from '../services';
import type { BackgroundJob } from './index';

/**
 * Despacha los mensajes programados que ya vencieron y entrega los
 * recordatorios cumplidos. Van juntos porque comparten la misma cadencia y el
 * mismo criterio: "algo que el usuario dejó agendado y ya es hora".
 */
async function run(): Promise<void> {
  const enviados = await scheduledService.despacharVencidos();
  const recordatorios = await scheduledService.entregarRecordatoriosVencidos();
  if (enviados > 0 || recordatorios > 0) {
    logger.info({ enviados, recordatorios }, 'Scheduled: despacho completado');
  }
}

const job: BackgroundJob = {
  name: 'scheduled-messages',
  schedule: '* * * * *', // cada minuto: la hora elegida por el usuario tiene precisión de minutos
  descripcion: 'Envía mensajes programados y recordatorios vencidos',
  run,
};

export default job;
