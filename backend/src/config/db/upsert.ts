import type { Expression, ExpressionBuilder, Kysely, SqlBool } from 'kysely';
import config from '../index';

/**
 * Upserts que funcionan en cualquier motor (docs/MULTI_DB.md, etapa 5).
 *
 * PostgreSQL usa `INSERT … ON CONFLICT`, igual que antes. SQL Server no lo tiene:
 * se intenta el INSERT y, si choca con la clave única, se hace el UPDATE (o se
 * ignora). Es seguro ante concurrencia porque la que decide es la restricción
 * única, no una consulta previa.
 */

type AnyDb = Kysely<any>;
type Row = Record<string, unknown>;
type UpdateSet = Row | ((eb: ExpressionBuilder<any, any>) => Row);

const isMssql = (): boolean => config.db.client === 'mssql';

/** Violación de UNIQUE/PK en SQL Server (2627 constraint, 2601 índice único). */
export function isUniqueViolation(err: unknown): boolean {
  const errors = Array.isArray(err) ? err : [err, (err as { cause?: unknown })?.cause];
  return errors.some((e) => {
    const n = (e as { number?: number })?.number;
    return n === 2627 || n === 2601;
  });
}

export interface UpsertOptions {
  table: string;
  values: Row;
  /** Columnas de la restricción única que define el conflicto. */
  conflict: string[];
  /** Qué actualizar si ya existe; sin `update`, la fila existente queda como está. */
  update?: UpdateSet;
  /** Sólo actualiza si además se cumple esta condición (sobre la fila existente). */
  updateWhere?: (eb: ExpressionBuilder<any, any>) => Expression<SqlBool>;
  /** Devolver la fila resultante (insertada o actualizada). */
  returning?: boolean;
}

/**
 * Inserta o actualiza una fila. Con `returning`, devuelve la fila; si no hubo
 * cambios (conflicto sin `update`, o `updateWhere` falso) devuelve undefined,
 * igual que `ON CONFLICT … RETURNING` en PostgreSQL.
 */
export async function upsert<T = Row>(db: AnyDb, opts: UpsertOptions): Promise<T | undefined> {
  const { table, values, conflict, update, updateWhere, returning } = opts;

  if (!isMssql()) {
    let q = db.insertInto(table).values(values).onConflict((oc) => {
      const target = oc.columns(conflict as any);
      if (!update) return target.doNothing();
      const set = target.doUpdateSet(update as any);
      return updateWhere ? set.where(updateWhere as any) : set;
    });
    if (returning) q = q.returningAll() as typeof q;
    return (await q.executeTakeFirst()) as T | undefined;
  }

  try {
    let q = db.insertInto(table).values(values);
    if (returning) q = q.returningAll() as typeof q;
    return (await q.executeTakeFirst()) as T | undefined;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  if (!update) return undefined;

  let u = db.updateTable(table).set(update as any);
  for (const column of conflict) {
    const v = values[column];
    u = v === null || v === undefined ? u.where(column, 'is', null) : u.where(column, '=', v);
  }
  if (updateWhere) u = u.where(updateWhere as any);
  if (returning) u = u.returningAll() as typeof u;
  return (await u.executeTakeFirst()) as T | undefined;
}

/**
 * Inserta las filas que no choquen con una clave única y deja las existentes
 * como están (`ON CONFLICT DO NOTHING`).
 */
export async function insertIgnore(db: AnyDb, table: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  if (!isMssql()) {
    await db.insertInto(table).values(rows).onConflict((oc) => oc.doNothing()).execute();
    return;
  }
  for (const row of rows) {
    try {
      await db.insertInto(table).values(row).execute();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
}
