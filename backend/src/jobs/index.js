const cron = require('node-cron');
const config = require('../config');
const logger = require('../config/logger');
const { isRedisEnabled, getRedisClient } = require('../config/redis');
const { recordJobRun } = require('../utils/cronJobStatus');

const jobs = [
  require('./presenceTimeout.job'),
  require('./presignedCleanup.job'),
  require('./scheduledBroadcasts.job'),
  require('./monitoringSnapshot.job'),
  require('./ldapSync.job'),
];

const tasks = [];

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
async function claimRun(jobName) {
  if (!isRedisEnabled()) return true;

  try {
    const client = await getRedisClient();
    const acquired = await client.set(`jobs:lock:${jobName}`, config.instanceId, {
      NX: true,
      EX: LOCK_TTL_SECONDS,
    });
    return acquired === 'OK';
  } catch (err) {
    // Ante la duda no ejecutamos: saltear un tick se recupera en el siguiente,
    // pero una difusión duplicada le llega dos veces al usuario.
    logger.warn({ err: err.message, job: jobName }, 'No se pudo tomar el lock del job — se saltea la corrida');
    return false;
  }
}

function startJobs() {
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
        logger.warn({ err: err.message, job: job.name }, 'Background job failed');
      }
    });
    tasks.push(task);
    logger.info({ job: job.name, schedule: job.schedule }, 'Background job scheduled');
  }
}

function stopJobs() {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
}

module.exports = { startJobs, stopJobs };
