import type { Selectable } from 'kysely';
import type { DB } from './db';

/**
 * Fila tal como la devuelve `SELECT *` con `pg`.
 *
 * `db.d.ts` lo genera kysely-codegen y envuelve las columnas con defaults en
 * `Generated<T>`, que describe a la vez leer, insertar y actualizar. Como acá se
 * usa `pg` crudo y sólo se leen filas, `Selectable` desenvuelve todo eso y deja
 * el tipo real de lectura.
 *
 * Uso desde JSDoc en un repositorio:
 *
 *   @returns {Promise<import('../types/rows').Row<'users'> | null>}
 *
 * Se escribe una sola vez: al agregar tablas basta con regenerar `db.d.ts`
 * (`npm run db:types`), este alias las toma solas.
 */
export type Row<T extends keyof DB> = Selectable<DB[T]>;
