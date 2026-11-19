import { sql, type RawBuilder } from 'kysely';

/**
 * Expresiones SQL que cambian según el motor, para usar dentro de consultas de
 * Kysely. Hoy sólo PostgreSQL; la rama de cada motor se suma en la etapa 3 de
 * docs/MULTI_DB.md sin tocar los repositorios.
 */

/** Momento actual (con zona horaria). */
export function now(): RawBuilder<Date> {
  return sql<Date>`now()`;
}

export type IntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days';

/** Ahora más `amount` unidades (ej. `nowPlus(15, 'minutes')`). */
export function nowPlus(amount: number, unit: IntervalUnit): RawBuilder<Date> {
  return sql<Date>`now() + ${`${amount} ${unit}`}::interval`;
}

/** Ahora menos `amount` unidades (ej. `nowMinus(90, 'days')`). */
export function nowMinus(amount: number, unit: IntervalUnit): RawBuilder<Date> {
  return sql<Date>`now() - ${`${amount} ${unit}`}::interval`;
}

/** Segundos enteros desde `column` hasta ahora. */
export function secondsSince(column: string): RawBuilder<number> {
  return sql<number>`EXTRACT(EPOCH FROM (now() - ${sql.ref(column)}))::integer`;
}

/** Comparación sin distinguir mayúsculas: `col ILIKE pattern` en PostgreSQL. */
export function ilike(column: string, pattern: string): RawBuilder<boolean> {
  return sql<boolean>`${sql.ref(column)} ILIKE ${pattern}`;
}

/** Campo de primer nivel de una columna JSON, como texto (`col->>'campo'`). */
export function jsonText(column: string, key: string): RawBuilder<string | null> {
  return sql<string | null>`(${sql.ref(column)}->>${sql.lit(key)})`;
}

/** La columna convertida a texto (para comparar un uuid con un campo JSON). */
export function asText(column: string): RawBuilder<string> {
  return sql<string>`${sql.ref(column)}::text`;
}

/** ¿Algún elemento (texto) del array JSON `column` coincide con `pattern` sin distinguir mayúsculas? */
export function jsonArrayLike(column: string, pattern: string): RawBuilder<boolean> {
  return sql<boolean>`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${sql.ref(column)}) k WHERE k ILIKE ${pattern})`;
}

/** Valor que va a una columna JSON: se serializa explícitamente. */
export function json(value: unknown): string {
  return JSON.stringify(value);
}
