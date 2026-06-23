const { Pool } = require('pg');
const config = require('../config');
const logger = require('./logger');
const metricsRegistry = require('../utils/metricsRegistry');

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
  logger.error({ err }, 'Unexpected database pool error');
});

const originalQuery = pool.query.bind(pool);
pool.query = (...args) => {
  metricsRegistry.recordDbQuery();
  return originalQuery(...args);
};

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
