const logger = require('../config/logger');
const { pool } = require('../config/database');

// Removes expired cached presigned URLs so the table doesn't grow unbounded.
// The backend regenerates URLs on demand, so deleting expired rows is safe.
async function run() {
  const { rowCount } = await pool.query(
    `DELETE FROM storage_presigned_urls WHERE expires_at < NOW()`
  );
  if (rowCount > 0) {
    logger.debug({ deleted: rowCount }, 'Cleaned up expired presigned URLs');
  }
}

module.exports = {
  name: 'presigned-cleanup',
  schedule: '*/15 * * * *', // every 15 minutes
  run,
};
