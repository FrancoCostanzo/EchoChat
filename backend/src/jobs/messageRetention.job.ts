import { messageService } from '../services';
import type { BackgroundJob } from './index';

// Borra los mensajes más viejos que `message_retention_days` (Admin → Sistema).
// Con 0, el valor por defecto, no hace nada.
async function run(): Promise<void> {
  await messageService.purgeExpired();
}

const job: BackgroundJob = {
  name: 'message-retention',
  schedule: '30 3 * * *', // todos los días a las 03:30
  descripcion: 'Borra los mensajes más viejos que la retención configurada',
  run,
};

export default job;
