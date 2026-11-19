import logger from '../config/logger';
import mailService from '../services/mail.service';
import type { BackgroundJob } from './index';

/** Manda los emails encolados (con reintentos y espera creciente ante fallos). */
async function run(): Promise<void> {
  const { sent, failed } = await mailService.processQueue();
  if (sent > 0 || failed > 0) logger.info({ sent, failed }, 'Email outbox: lote procesado');
}

const job: BackgroundJob = {
  name: 'email-outbox',
  schedule: '* * * * *',
  descripcion: 'Envía los emails encolados',
  run,
};

export default job;
