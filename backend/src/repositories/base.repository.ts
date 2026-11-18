import type { QueryResult, QueryResultRow } from 'pg';
import type { Kysely } from 'kysely';
import { pool } from '../config/database';
import { db, type Db } from '../config/db';

/**
 * Repositorio base del que heredan los 21 repositorios restantes.
 *
 * `T` es la fila de la tabla que maneja cada subclase, normalmente
 * `Row<'tabla'>` de los tipos generados desde el schema (ver `types/rows.d.ts`).
 * Con eso, `findById()` devuelve la fila tipada sin que cada repositorio tenga
 * que declararlo.
 *
 * `query()` acepta su propio parámetro `R` para las consultas cuyo resultado no
 * es una fila de la tabla: agregados (`COUNT`), proyecciones o JOINs.
 *
 * `db` es el query builder de Kysely, que genera el SQL del motor activo. Los
 * repositorios se pasan de `query()` a `db` de a uno (docs/MULTI_DB.md).
 */
class BaseRepository<T extends QueryResultRow = any> {
  tableName: string;
  pool: typeof pool;
  db: Db;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.pool = pool;
    this.db = db;
  }

  async query<R extends QueryResultRow = T>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, params);
  }

  async findById(id: string): Promise<T | null> {
    const row = await this.table().selectFrom(this.tableName).selectAll().where('id', '=', id).executeTakeFirst();
    return (row as T | undefined) ?? null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.table().deleteFrom(this.tableName).where('id', '=', id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async exists(id: string): Promise<boolean> {
    const row = await this.table().selectFrom(this.tableName).select('id').where('id', '=', id).executeTakeFirst();
    return !!row;
  }

  /**
   * `db` sin tipar la tabla: los métodos genéricos de arriba no saben en
   * compilación qué tabla maneja la subclase (`tableName` es un string).
   */
  private table(): Kysely<Record<string, { id: string }>> {
    return this.db as unknown as Kysely<Record<string, { id: string }>>;
  }
}

export default BaseRepository;
