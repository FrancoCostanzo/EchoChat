const cron = require('node-cron');
const logger = require('../config/logger');
const { recordJobRun } = require('../utils/cronJobStatus');

const jobs = [
  require('./presenceTimeout.job'),
  require('./presignedCleanup.job'),
  require('./scheduledBroadcasts.job'),
  require('./monitoringSnapshot.job'),
];

const tasks = [];

function startJobs() {
  for (const job of jobs) {
    if (!cron.validate(job.schedule)) {
      logger.error({ job: job.name, schedule: job.schedule }, 'Invalid cron schedule, skipping job');
      continue;
    }
    const task = cron.schedule(job.schedule, async () => {
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
