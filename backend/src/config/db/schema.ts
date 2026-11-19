import { sql, type ColumnDataType, type Expression, type Kysely } from 'kysely';
import config from '../index';

/**
 * Piezas portables para escribir migraciones con el schema builder de Kysely.
 *
 * Cada helper devuelve el tipo o la expresión del motor activo (`DB_CLIENT`).
 * Hoy sólo está PostgreSQL; al sumar un motor (docs/MULTI_DB.md, etapas 4 y 5)
 * se agrega su rama acá y las migraciones no cambian.
 */

type DataType = ColumnDataType | Expression<unknown>;

/** Tipos de columna. */
export const t = {
  uuid: (): DataType => 'uuid',
  text: (): DataType => 'text',
  varchar: (length: number): DataType => `varchar(${length})`,
  char: (length: number): DataType => `char(${length})`,
  smallint: (): DataType => 'smallint',
  integer: (): DataType => 'integer',
  bigint: (): DataType => 'bigint',
  /** Entero autoincremental de 64 bits (PostgreSQL: BIGSERIAL). */
  bigserial: (): DataType => 'bigserial',
  boolean: (): DataType => 'boolean',
  numeric: (precision: number, scale: number): DataType => `numeric(${precision}, ${scale})`,
  /** Fecha y hora con zona horaria. */
  timestamptz: (): DataType => 'timestamptz',
  time: (): DataType => 'time',
  /** Documento JSON. */
  json: (): DataType => 'jsonb',
  /** Dirección IP (v4 o v6). */
  ip: (): DataType => sql`inet`,
  /**
   * Lista de valores. Sólo la usa `001_initial` (esquema histórico): en PostgreSQL
   * crea el array y la migración 003 lo pasa a JSON. Al sumar otro motor, debe
   * devolver su tipo JSON (etapa 4). Para columnas nuevas usar `t.json()`.
   */
  array: (of: 'text' | 'uuid' | 'smallint'): DataType => sql.raw(`${of}[]`),
};

/** Valores por defecto que dependen del motor. */
export const d = {
  /** Momento actual. */
  now: () => sql`now()`,
  /** UUID aleatorio. */
  uuid: () => sql`uuid_generate_v4()`,
};

export const isPostgres = (): boolean => config.db.client === 'postgres';

/**
 * Corre `fn` sólo en PostgreSQL: extensiones, índices GIN, triggers y funciones
 * PL/pgSQL. Lo que se marque así tiene que tener un equivalente (o no hacer
 * falta) en los demás motores.
 */
export async function onPostgres(db: Kysely<any>, fn: (db: Kysely<any>) => Promise<unknown>): Promise<void> {
  if (isPostgres()) await fn(db);
}
