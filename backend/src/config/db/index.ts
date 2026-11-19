import { Kysely, MssqlDialect, PostgresDialect, sql, type Dialect, type Transaction } from 'kysely';
import * as Tedious from 'tedious';
import * as Tarn from 'tarn';
import config from '../index';
import { pool } from '../database';
import * as metricsRegistry from '../../utils/metricsRegistry';
import type { DB } from '../../types/db';
import { now } from './sql';
import { UpdatedAtPlugin } from './updatedAtPlugin';

/**
 * Acceso a la base con Kysely: el query builder genera el SQL del motor que
 * elija `DB_CLIENT`. Convive con el `pool` de `pg` mientras los repositorios se
 * pasan de a uno (docs/MULTI_DB.md, etapa 2).
 */

function createDialect(): Dialect {
  const { client, host, port, database, user, password, min, max, encrypt, trustServerCertificate } = config.db;
  switch (client) {
    case 'postgres':
      // Mismo pool que usa `query()`: una sola configuración y un solo límite de conexiones.
      return new PostgresDialect({ pool });
    case 'mssql':
      return new MssqlDialect({
        tarn: { ...Tarn, options: { min, max } },
        tedious: {
          ...Tedious,
          connectionFactory: () => new Tedious.Connection({
            server: host,
            authentication: { type: 'default', options: { userName: user, password } },
            options: { port, database, encrypt, trustServerCertificate },
          }),
        },
      });
  }
}

export const db = new Kysely<DB>({
  dialect: createDialect(),
  // Reemplaza al trigger fn_set_updated_at (ver updatedAtPlugin.ts).
  plugins: [new UpdatedAtPlugin()],
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

/** Consulta mínima para saber si la base responde (health checks). */
export async function pingDb(): Promise<{ test: number; timestamp: Date }> {
  const { rows } = await sql<{ test: number; timestamp: Date }>`SELECT 1 AS test, ${now()} AS timestamp`.execute(db);
  return rows[0];
}
