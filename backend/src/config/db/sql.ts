import { sql, type RawBuilder } from 'kysely';
import config from '../index';

/**
 * Expresiones SQL que cambian según el motor, para usar dentro de consultas de
 * Kysely. Cada una tiene su versión de PostgreSQL y de SQL Server: los
 * repositorios las usan sin saber qué motor hay abajo (docs/MULTI_DB.md).
 */

const mssql = (): boolean => config.db.client === 'mssql';

/** Momento actual (con zona horaria). */
export function now(): RawBuilder<Date> {
  return mssql() ? sql<Date>`SYSDATETIMEOFFSET()` : sql<Date>`now()`;
}

export type IntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days';

const MSSQL_UNIT: Record<IntervalUnit, string> = { seconds: 'second', minutes: 'minute', hours: 'hour', days: 'day' };

function shift(amount: number, unit: IntervalUnit): RawBuilder<Date> {
  if (mssql()) return sql<Date>`DATEADD(${sql.raw(MSSQL_UNIT[unit])}, ${amount}, SYSDATETIMEOFFSET())`;
  return amount >= 0
    ? sql<Date>`now() + ${`${amount} ${unit}`}::interval`
    : sql<Date>`now() - ${`${-amount} ${unit}`}::interval`;
}

/** Ahora más `amount` unidades (ej. `nowPlus(15, 'minutes')`). */
export function nowPlus(amount: number, unit: IntervalUnit): RawBuilder<Date> {
  return shift(amount, unit);
}

/** Ahora menos `amount` unidades (ej. `nowMinus(90, 'days')`). */
export function nowMinus(amount: number, unit: IntervalUnit): RawBuilder<Date> {
  return shift(-amount, unit);
}

/** Ahora más `2^exponent` minutos, con el exponente sacado de una columna (reintentos). */
export function nowPlusPowerOfTwoMinutes(exponent: RawBuilder<number>): RawBuilder<Date> {
  return mssql()
    ? sql<Date>`DATEADD(minute, CAST(POWER(2, ${exponent}) AS int), SYSDATETIMEOFFSET())`
    : sql<Date>`now() + make_interval(mins => POWER(2, ${exponent})::int)`;
}

/** Segundos enteros desde `column` hasta ahora. */
export function secondsSince(column: string): RawBuilder<number> {
  return mssql()
    ? sql<number>`DATEDIFF(second, ${sql.ref(column)}, SYSDATETIMEOFFSET())`
    : sql<number>`EXTRACT(EPOCH FROM (now() - ${sql.ref(column)}))::integer`;
}

/**
 * Comparación sin distinguir mayúsculas. En SQL Server, `LIKE` ya es así con la
 * collation por defecto (`*_CI_*`).
 */
export function ilike(column: string, pattern: string): RawBuilder<boolean> {
  return mssql()
    ? sql<boolean>`${sql.ref(column)} LIKE ${pattern}`
    : sql<boolean>`${sql.ref(column)} ILIKE ${pattern}`;
}

/** Campo de primer nivel de una columna JSON, como texto (`col->>'campo'`). */
export function jsonText(column: string, key: string): RawBuilder<string | null> {
  return mssql()
    ? sql<string | null>`JSON_VALUE(${sql.ref(column)}, ${sql.lit(`$.${key}`)})`
    : sql<string | null>`(${sql.ref(column)}->>${sql.lit(key)})`;
}

/**
 * La columna convertida a texto (para comparar un uuid con un campo JSON). En
 * SQL Server los uniqueidentifier salen en mayúscula; el JSON los guarda en
 * minúscula, así que se baja.
 */
export function asText(column: string): RawBuilder<string> {
  return mssql()
    ? sql<string>`LOWER(CONVERT(nvarchar(36), ${sql.ref(column)}))`
    : sql<string>`${sql.ref(column)}::text`;
}

/** ¿Algún elemento (texto) del array JSON `column` coincide con `pattern` sin distinguir mayúsculas? */
export function jsonArrayLike(column: string, pattern: string): RawBuilder<boolean> {
  return mssql()
    ? sql<boolean>`EXISTS (SELECT 1 FROM OPENJSON(${sql.ref(column)}) k WHERE k.value LIKE ${pattern})`
    : sql<boolean>`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${sql.ref(column)}) k WHERE k ILIKE ${pattern})`;
}

/** Booleano literal (SQL Server no tiene true/false: usa 1/0). */
export function bool(value: boolean): RawBuilder<boolean> {
  return mssql() ? sql<boolean>`${sql.raw(value ? '1' : '0')}` : sql<boolean>`${sql.raw(String(value))}`;
}

/** Valor que va a una columna JSON: se serializa explícitamente. */
export function json(value: unknown): string {
  return JSON.stringify(value);
}
