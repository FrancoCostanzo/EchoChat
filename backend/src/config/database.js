const { Pool } = require('pg');
const config = require('../config');
const logger = require('./logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  min: config.db.min,
  max: config.db.max,
});

pool.on('connect', () => {
  logger.debug('New database client connected');
});

pool.on('error', (err) => {
  logger.fatal({ err }, 'Unexpected database pool error');
  process.exit(1);
});

/**
 * Execute a callback inside a transaction.
 * Automatically commits on success and rolls back on error.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
