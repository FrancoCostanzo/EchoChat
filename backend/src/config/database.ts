import { Pool, type PoolClient } from 'pg';
import config from '../config';
import logger from './logger';
import * as metricsRegistry from '../utils/metricsRegistry';

export const pool = new Pool({
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
// Envuelve query() para contar las consultas en las métricas. El cast hace
// falta porque pool.query tiene varias sobrecargas y TypeScript no permite
// reasignarlas con una sola firma variádica.
(pool as any).query = (...args: any[]) => {
  metricsRegistry.recordDbQuery();
  return (originalQuery as any)(...args);
};

/**
 * Execute a callback inside a transaction.
 * Automatically commits on success and rolls back on error.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
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
