import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import config from '../config';
import logger from '../config/logger';
import { getRedisClient } from '../config/redis';
import { recordJobRun } from '../utils/cronJobStatus';
import presenceTimeoutJob from './presenceTimeout.job';
import presignedCleanupJob from './presignedCleanup.job';
import scheduledBroadcastsJob from './scheduledBroadcasts.job';
import monitoringSnapshotJob from './monitoringSnapshot.job';
import ldapSyncJob from './ldapSync.job';
import awayExpiryJob from './awayExpiry.job';
import scheduledMessagesJob from './scheduledMessages.job';

/** Lo que cada archivo de job exporta. */
export interface BackgroundJob {
  name: string;
  schedule: string;
  /** Texto que muestra el panel de monitoreo; si falta se usa `name`. */
  descripcion?: string;
  run: () => Promise<void>;
}

const jobs: BackgroundJob[] = [
  presenceTimeoutJob,
  presignedCleanupJob,
  scheduledBroadcastsJob,
  monitoringSnapshotJob,
  ldapSyncJob,
  awayExpiryJob,
  scheduledMessagesJob,
];

const tasks: ScheduledTask[] = [];

// Ventana del lock que decide quién ejecuta cada corrida. Todas las instancias
// disparan el mismo tick con milisegundos de diferencia, así que alcanza con
// unos segundos. El lock NO se libera al terminar a propósito: soltarlo antes
// dejaría que otra instancia repitiera la misma corrida.
const LOCK_TTL_SECONDS = 30;

/**
 * ¿Le toca a esta instancia ejecutar esta corrida? Sin Redis siempre sí (una
 * sola instancia). Con Redis gana la primera que consigue el SET NX, y el resto
 * se saltea el tick: sin esto, con N instancias una difusión programada se
 * enviaría N veces.
 */
async function claimRun(jobName: string): Promise<boolean> {
  try {
    // Sin cliente no hay REDIS_URL, o sea una sola instancia: le toca a esta.
    const client = await getRedisClient();
    if (!client) return true;
    const acquired = await client.set(`jobs:lock:${jobName}`, config.instanceId, {
      NX: true,
      EX: LOCK_TTL_SECONDS,
    });
    return acquired === 'OK';
  } catch (err) {
    // Ante la duda no ejecutamos: saltear un tick se recupera en el siguiente,
    // pero una difusión duplicada le llega dos veces al usuario.
    logger.warn({ err: (err as Error).message, job: jobName }, 'No se pudo tomar el lock del job — se saltea la corrida');
    return false;
  }
}

function startJobs(): void {
  if (!config.jobs.enabled) {
    logger.info('RUN_JOBS=false — esta instancia no ejecuta jobs en background');
    return;
  }

  for (const job of jobs) {
    if (!cron.validate(job.schedule)) {
      logger.error({ job: job.name, schedule: job.schedule }, 'Invalid cron schedule, skipping job');
      continue;
    }
    const task = cron.schedule(job.schedule, async () => {
      if (!(await claimRun(job.name))) {
        logger.debug({ job: job.name }, 'Corrida tomada por otra instancia');
        return;
      }
      try {
        await job.run();
        recordJobRun(job.name, {
          descripcion: job.descripcion || job.name,
          resultado: 'success',
          origen: 'automatica',
        });
      } catch (err) {
        recordJobRun(job.name, {
          descripcion: job.descripcion || job.name,
          resultado: 'error',
          origen: 'automatica',
        });
        logger.warn({ err: (err as Error).message, job: job.name }, 'Background job failed');
      }
    });
    tasks.push(task);
    logger.info({ job: job.name, schedule: job.schedule }, 'Background job scheduled');
  }
}

function stopJobs(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
}

export { startJobs, stopJobs };
