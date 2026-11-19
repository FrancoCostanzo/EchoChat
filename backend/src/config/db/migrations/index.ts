import type { Migration } from 'kysely/migration';
import * as m001 from './001_initial';
import * as m002 from './002_drop_triggers';

/**
 * Migraciones del esquema, en orden. Para un cambio nuevo: crear
 * `NNN_descripcion.ts` (siguiente número) con `up()` usando el schema builder y
 * los helpers de `../schema`, y agregarla acá. Se aplica una vez y queda
 * registrada en `kysely_migration`.
 */
export const migrations: Record<string, Migration> = {
  '001_initial': m001,
  '002_drop_triggers': m002,
};

/** La migración que equivale al esquema histórico (.sql). */
export const INITIAL_MIGRATION = '001_initial';
