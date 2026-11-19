import { sql, type Expression, type SqlBool } from 'kysely';
import { db } from '../config/db';
import { ilike, json } from '../config/db/sql';
import type { Row } from '../types/rows';
import type { AuditEntryRow } from '../models/admin.model';

/**
 * Entrada de auditoría. Casi todo es opcional a propósito: cada punto del código
 * registra lo que tiene a mano. Hasta que esto estuvo declarado, TypeScript
 * infería que todos los campos eran obligatorios a partir de la desestructuración
 * y protestaba en cada llamada.
 */
export interface AuditEntryInput {
  action: string;
  actor_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  data_before?: unknown;
  data_after?: unknown;
  success?: boolean;
  error_message?: string | null;
  severity?: string;
  category?: string;
  session_id?: string | null;
  duration_ms?: number | null;
  metadata?: unknown;
}

export interface AuditSearchFilters {
  action?: string;
  actor_id?: string;
  resource_type?: string;
  success?: boolean | string;
  from?: string | Date;
  to?: string | Date;
  severity?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sort_column?: string;
  sort_dir?: string;
}

/** No hereda de BaseRepository: sólo escribe y consulta, nunca por id. */
class AuditRepository {
  async log({
    actor_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    data_before,
    data_after,
    success = true,
    error_message,
    severity = 'info',
    category = 'system',
    session_id,
    duration_ms,
    metadata,
  }: AuditEntryInput): Promise<Row<'audit_log'>> {
    const row = await db.insertInto('audit_log')
      .values({
        actor_id: actor_id || null,
        action,
        resource_type: resource_type || null,
        resource_id: resource_id || null,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
        data_before: data_before ? json(data_before) : null,
        data_after: data_after ? json(data_after) : null,
        success,
        error_message: error_message || null,
        severity,
        category,
        session_id: session_id || null,
        duration_ms: duration_ms ?? null,
        metadata: metadata ? json(metadata) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as Row<'audit_log'>;
  }

  async findByActor(
    actorId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<Row<'audit_log'>[]> {
    return db.selectFrom('audit_log').selectAll()
      .where('actor_id', '=', actorId)
      .orderBy('created_at', 'desc')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<Row<'audit_log'>[]>;
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<Row<'audit_log'>[]> {
    return db.selectFrom('audit_log').selectAll()
      .where('resource_type', '=', resourceType)
      .where('resource_id', '=', resourceId)
      .orderBy('created_at', 'desc')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<Row<'audit_log'>[]>;
  }

  /** Columnas ordenables (lista blanca) → expresión SQL. */
  static #SORT_COLUMNS: Record<string, Expression<unknown>> = {
    created_at: sql.ref('a.created_at'),
    action: sql.ref('a.action'),
    severity: sql.ref('a.severity'),
    category: sql.ref('a.category'),
    actor: sql`COALESCE(u.display_name, u.username)`,
    success: sql.ref('a.success'),
  };

  /** Consulta base con los filtros, compartida por search() y searchWithCount(). */
  #filtered({ action, actor_id, resource_type, success, from, to, severity, category }: AuditSearchFilters) {
    let q = db.selectFrom('audit_log as a').leftJoin('users as u', 'u.id', 'a.actor_id');
    if (action) q = q.where(ilike('a.action', `%${action}%`) as Expression<SqlBool>);
    if (actor_id) q = q.where('a.actor_id', '=', actor_id);
    if (resource_type) q = q.where('a.resource_type', '=', resource_type);
    if (severity) q = q.where('a.severity', '=', severity);
    if (category) q = q.where('a.category', '=', category);
    if (success !== undefined && success !== null && success !== '') {
      q = q.where('a.success', '=', success === 'true' || success === true);
    }
    // Las fechas pasan tal cual (string o Date): la base interpreta el string con su zona horaria.
    if (from) q = q.where('a.created_at', '>=', from as Date);
    if (to) q = q.where('a.created_at', '<=', to as Date);
    return q;
  }

  async search(filters: AuditSearchFilters = {}): Promise<AuditEntryRow[]> {
    const { limit = 50, offset = 0, sort_column, sort_dir, ...rest } = filters;
    const col = (sort_column ? AuditRepository.#SORT_COLUMNS[sort_column] : undefined) ?? AuditRepository.#SORT_COLUMNS.created_at;
    const dir = sort_dir === 'ascending' ? 'asc' : 'desc';
    return this.#filtered(rest)
      .selectAll('a')
      .select(['u.display_name as actor_display_name', 'u.username as actor_username'])
      .orderBy(col, dir)
      // Siempre desempata por id DESC para que el orden sea estable.
      .orderBy('a.id', 'desc')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<AuditEntryRow[]>;
  }

  async searchWithCount(filters: AuditSearchFilters = {}): Promise<{ rows: AuditEntryRow[]; total: number }> {
    const { limit: _limit, offset: _offset, sort_column: _sc, sort_dir: _sd, ...rest } = filters;
    const { total } = await this.#filtered(rest)
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .executeTakeFirstOrThrow();
    const rows = await this.search(filters);
    return { rows, total: parseInt(String(total), 10) };
  }
}

export default new AuditRepository();
