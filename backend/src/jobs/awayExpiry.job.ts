import logger from '../config/logger';
import { toAll } from '../config/eventBus';
import { userRepository } from '../repositories';
import type { BackgroundJob } from './index';

/**
 * Vence los estados de ausencia: cuando pasa `away_until`, limpia el mensaje y
 * devuelve la presencia a `online`.
 *
 * Sin esto, quien puso "de licencia hasta el viernes" vuelve el lunes y sigue
 * apareciendo ausente hasta que se acuerde de sacarlo a mano — y peor, sus DMs
 * siguen auto-respondiendo.
 */
async function run(): Promise<void> {
  const vencidos = await userRepository.findExpiredAway();
  if (vencidos.length === 0) return;

  for (const usuario of vencidos) {
    try {
      const actualizado = await userRepository.clearAwayState(usuario.id);
      toAll('presence:changed', {
        userId: usuario.id,
        presence: actualizado?.presence ?? 'online',
        presence_message: null,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId: usuario.id }, 'No se pudo vencer la ausencia');
    }
  }
  logger.debug({ count: vencidos.length }, 'Away expiry: ausencias limpiadas');
}

const job: BackgroundJob = {
  name: 'away-expiry',
  schedule: '*/5 * * * *', // cada 5 minutos: la precisión al minuto no aporta acá
  descripcion: 'Vence los estados de ausencia cumplidos',
  run,
};

export default job;
