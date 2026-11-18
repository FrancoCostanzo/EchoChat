import { Kysely, PostgresDialect, type Dialect, type Transaction } from 'kysely';
import config from '../index';
import { pool } from '../database';
import * as metricsRegistry from '../../utils/metricsRegistry';
import type { DB } from '../../types/db';

/**
 * Acceso a la base con Kysely: el query builder genera el SQL del motor que
 * elija `DB_CLIENT`. Convive con el `pool` de `pg` mientras los repositorios se
 * pasan de a uno (docs/MULTI_DB.md, etapa 2).
 */

function createDialect(): Dialect {
  switch (config.db.client) {
    case 'postgres':
      // Mismo pool que usa `query()`: una sola configuración y un solo límite de conexiones.
      return new PostgresDialect({ pool });
  }
}

export const db = new Kysely<DB>({
  dialect: createDialect(),
  // Kysely saca conexiones con pool.connect(), así que no pasa por el
  // pool.query() instrumentado de database.ts: las contamos acá.
  log(event) {
    if (event.level === 'query' || event.level === 'error') metricsRegistry.recordDbQuery();
  },
});

export type Db = Kysely<DB>;
export type DbTransaction = Transaction<DB>;

/** Corre `callback` en una transacción: commit si termina bien, rollback si lanza. */
export function transaction<T>(callback: (trx: DbTransaction) => Promise<T>): Promise<T> {
  return db.transaction().execute(callback);
}
