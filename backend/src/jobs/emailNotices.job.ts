import logger from '../config/logger';
import emailNoticesService from '../services/emailNotices.service';
import type { BackgroundJob } from './index';

/**
 * Emails que dependen del paso del tiempo: avisos que siguen sin leer y chats
 * con mensajes sin leer (cada 5 minutos, que es la granularidad de la espera
 * mínima de 15) y, en el minuto 0 de cada hora, los resúmenes periódicos.
 */
async function run(): Promise<void> {
  const avisos = await emailNoticesService.sendPendingNotices();
  const chats = await emailNoticesService.sendUnreadConversations();
  const resumenes = new Date().getMinutes() < 5 ? await emailNoticesService.sendDigests() : 0;
  if (avisos > 0 || chats > 0 || resumenes > 0) {
    logger.info({ avisos, chats, resumenes }, 'Email notices: encolados');
  }
}

const job: BackgroundJob = {
  name: 'email-notices',
  schedule: '*/5 * * * *',
  descripcion: 'Encola emails de avisos sin leer, mensajes sin leer y resúmenes',
  run,
};

export default job;
