const cron = require('node-cron');
const logger = require('../config/logger');

// Background jobs registry. Each job module exports { name, schedule, run }.
// `schedule` is a standard cron expression. Add future jobs here:
//   - scheduled broadcasts (Fase 3)
//   - message retention enforcement (system_settings.message_retention_days)
//   - async media processing (Fase 4)
const jobs = [
  require('./presenceTimeout.job'),
  require('./presignedCleanup.job'),
  require('./scheduledBroadcasts.job'),
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
      } catch (err) {
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
