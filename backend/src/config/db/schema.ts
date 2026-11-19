import { sql, type ColumnDataType, type Expression, type Kysely } from 'kysely';
import config from '../index';

/**
 * Piezas portables para escribir migraciones con el schema builder de Kysely.
 *
 * Cada helper devuelve el tipo o la expresión del motor activo (`DB_CLIENT`).
 * Para sumar un motor se agrega su rama acá y las migraciones no cambian
 * (docs/MULTI_DB.md).
 */

type DataType = ColumnDataType | Expression<unknown>;

export const isPostgres = (): boolean => config.db.client === 'postgres';
export const isMssql = (): boolean => config.db.client === 'mssql';

/** Elige el valor del motor activo. */
function byClient<T>(values: { postgres: T; mssql: T }): T {
  return values[config.db.client];
}

/** Tipos de columna. */
export const t = {
  uuid: (): DataType => byClient<DataType>({ postgres: 'uuid', mssql: sql`uniqueidentifier` }),
  /** Texto sin límite. En SQL Server no se puede indexar: para claves, `varchar(n)`. */
  text: (): DataType => byClient<DataType>({ postgres: 'text', mssql: sql`nvarchar(max)` }),
  /**
   * Texto que es parte de una clave o índice. En PostgreSQL es `text`; SQL Server
   * no indexa `nvarchar(max)`, así que ahí lleva largo (máx. 850 = 1700 bytes).
   */
  keyText: (length: number): DataType => byClient<DataType>({ postgres: 'text', mssql: sql.raw(`nvarchar(${length})`) }),
  varchar: (length: number): DataType => byClient<DataType>({ postgres: `varchar(${length})`, mssql: sql.raw(`nvarchar(${length})`) }),
  char: (length: number): DataType => byClient<DataType>({ postgres: `char(${length})`, mssql: sql.raw(`nchar(${length})`) }),
  smallint: (): DataType => 'smallint',
  integer: (): DataType => 'integer',
  bigint: (): DataType => 'bigint',
  /** Entero autoincremental de 64 bits. */
  bigserial: (): DataType => byClient<DataType>({ postgres: 'bigserial', mssql: sql`bigint IDENTITY(1,1)` }),
  boolean: (): DataType => byClient<DataType>({ postgres: 'boolean', mssql: sql`bit` }),
  numeric: (precision: number, scale: number): DataType => `numeric(${precision}, ${scale})`,
  /** Fecha y hora con zona horaria. */
  timestamptz: (): DataType => byClient<DataType>({ postgres: 'timestamptz', mssql: sql`datetimeoffset` }),
  time: (): DataType => 'time',
  /** Documento JSON (en SQL Server, texto validado con ISJSON donde haga falta). */
  json: (): DataType => byClient<DataType>({ postgres: 'jsonb', mssql: sql`nvarchar(max)` }),
  /** Dirección IP (v4 o v6). */
  ip: (): DataType => byClient<DataType>({ postgres: sql`inet`, mssql: sql`varchar(45)` }),
  /**
   * Lista de valores. Sólo la usa `001_initial` (esquema histórico): en PostgreSQL
   * crea el array y la migración 003 lo pasa a JSON; en los demás motores ya es
   * JSON. Para columnas nuevas usar `t.json()`.
   */
  array: (of: 'text' | 'uuid' | 'smallint'): DataType => byClient<DataType>({
    postgres: sql.raw(`${of}[]`),
    mssql: sql`nvarchar(max)`,
  }),
};

/** Valores por defecto que dependen del motor. */
export const d = {
  /** Momento actual. */
  now: () => byClient({ postgres: sql`now()`, mssql: sql`SYSDATETIMEOFFSET()` }),
  /** UUID aleatorio. */
  uuid: () => byClient({ postgres: sql`uuid_generate_v4()`, mssql: sql`NEWID()` }),
  /** Booleano literal (SQL Server no tiene true/false: usa 1/0). */
  bool: (value: boolean) => byClient({ postgres: sql.raw(String(value)), mssql: sql.raw(value ? '1' : '0') }),
};

/**
 * Corre `fn` sólo en PostgreSQL: extensiones, índices GIN, triggers y funciones
 * PL/pgSQL. Lo que se marque así tiene que tener un equivalente (o no hacer
 * falta) en los demás motores.
 */
export async function onPostgres(db: Kysely<any>, fn: (db: Kysely<any>) => Promise<unknown>): Promise<void> {
  if (isPostgres()) await fn(db);
}

/**
 * `ON DELETE` que SQL Server rechaza por "multiple cascade paths" (la tabla ya
 * cae en cascada por otro camino). Ahí queda NO ACTION: son tablas padre que la
 * app sólo borra lógicamente, salvo `sticker_packs`, que antes de borrarse
 * desvincula sus stickers (sticker.repository.deletePack).
 */
export function onDeleteExceptMssql<T extends { onDelete(action: OnDeleteAction): T }>(fk: T, action: OnDeleteAction): T {
  return isMssql() ? fk : fk.onDelete(action);
}

type OnDeleteAction = 'cascade' | 'set null' | 'restrict' | 'no action' | 'set default';

/** Corre `fn` sólo en SQL Server. */
export async function onMssql(db: Kysely<any>, fn: (db: Kysely<any>) => Promise<unknown>): Promise<void> {
  if (isMssql()) await fn(db);
}
