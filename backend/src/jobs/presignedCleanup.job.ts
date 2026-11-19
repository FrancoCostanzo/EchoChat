import logger from '../config/logger';
import { storageRepository } from '../repositories';
import type { BackgroundJob } from './index';

// Removes expired cached presigned URLs so the table doesn't grow unbounded.
// The backend regenerates URLs on demand, so deleting expired rows is safe.
async function run(): Promise<void> {
  const deleted = await storageRepository.deleteExpiredPresignedUrls();
  if (deleted > 0) {
    logger.debug({ deleted }, 'Cleaned up expired presigned URLs');
  }
}

const job: BackgroundJob = {
  name: 'presigned-cleanup',
  schedule: '*/15 * * * *', // every 15 minutes
  run,
};

export default job;
