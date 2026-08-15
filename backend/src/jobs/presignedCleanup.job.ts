import logger from '../config/logger';
import { pool } from '../config/database';
import type { BackgroundJob } from './index';

// Removes expired cached presigned URLs so the table doesn't grow unbounded.
// The backend regenerates URLs on demand, so deleting expired rows is safe.
async function run(): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM storage_presigned_urls WHERE expires_at < NOW()`
  );
  if (rowCount && rowCount > 0) {
    logger.debug({ deleted: rowCount }, 'Cleaned up expired presigned URLs');
  }
}

const job: BackgroundJob = {
  name: 'presigned-cleanup',
  schedule: '*/15 * * * *', // every 15 minutes
  run,
};

export = job;
