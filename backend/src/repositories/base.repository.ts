import type { QueryResult, QueryResultRow } from 'pg';
import { pool } from '../config/database';

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
 */
class BaseRepository<T extends QueryResultRow = any> {
  tableName: string;
  pool: typeof pool;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.pool = pool;
  }

  async query<R extends QueryResultRow = T>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, params);
  }

  async findById(id: string): Promise<T | null> {
    const { rows } = await this.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async deleteById(id: string): Promise<boolean> {
    const { rowCount } = await this.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return (rowCount ?? 0) > 0;
  }

  async exists(id: string): Promise<boolean> {
    const { rows } = await this.query(
      `SELECT 1 FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rows.length > 0;
  }
}

// `export =` y no `export default`: los repositorios que todavía son .js hacen
// `require('./base.repository')` y lo extienden directo. Con export default
// recibirían { default: ... } y el `extends` fallaría en runtime.
export = BaseRepository;
