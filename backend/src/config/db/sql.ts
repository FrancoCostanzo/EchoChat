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

/** Valor que va a una columna JSON: se serializa explícitamente. */
export function json(value: unknown): string {
  return JSON.stringify(value);
}
