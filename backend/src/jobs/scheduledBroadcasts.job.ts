import logger from '../config/logger';
import { broadcastService } from '../services';
import type { BackgroundJob } from './index';

// Dispatches broadcast messages whose scheduled_at has passed.
async function run(): Promise<void> {
  const count = await broadcastService.processDueScheduled();
  if (count > 0) {
    logger.info({ count }, 'Scheduled broadcasts dispatched');
  }
}

const job: BackgroundJob = {
  name: 'scheduled-broadcasts',
  schedule: '* * * * *',
  run,
};

export = job;
