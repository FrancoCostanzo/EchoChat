import { pool } from '../config/database';
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
    const { rows } = await pool.query<Row<'audit_log'>>(
      `INSERT INTO audit_log
         (actor_id, action, resource_type, resource_id, ip_address, user_agent,
          data_before, data_after, success, error_message,
          severity, category, session_id, duration_ms, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        actor_id || null,
        action,
        resource_type || null,
        resource_id || null,
        ip_address || null,
        user_agent || null,
        data_before ? JSON.stringify(data_before) : null,
        data_after ? JSON.stringify(data_after) : null,
        success,
        error_message || null,
        severity,
        category,
        session_id || null,
        duration_ms ?? null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return rows[0];
  }

  async findByActor(
    actorId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<Row<'audit_log'>[]> {
    const { rows } = await pool.query<Row<'audit_log'>>(
      `SELECT * FROM audit_log WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [actorId, limit, offset],
    );
    return rows;
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<Row<'audit_log'>[]> {
    const { rows } = await pool.query<Row<'audit_log'>>(
      `SELECT * FROM audit_log
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [resourceType, resourceId, limit, offset],
    );
    return rows;
  }

  /** Whitelisted sortable columns → SQL expression. */
  static #SORT_COLUMNS: Record<string, string> = {
    created_at: 'a.created_at',
    action:     'a.action',
    severity:   'a.severity',
    category:   'a.category',
    actor:      'COALESCE(u.display_name, u.username)',
    success:    'a.success',
  };

  #buildOrderBy(sort_column?: string, sort_dir?: string): string {
    const col = (sort_column && AuditRepository.#SORT_COLUMNS[sort_column]) ?? 'a.created_at';
    const dir = sort_dir === 'ascending' ? 'ASC' : 'DESC';
    // Always secondary-sort by id DESC so order is stable within a tie.
    return `${col} ${dir}, a.id DESC`;
  }

  /** Builds the WHERE clause shared by search() and searchWithCount(). */
  #buildWhere({ action, actor_id, resource_type, success, from, to, severity, category }: AuditSearchFilters) {
    const conditions = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (action) {
      conditions.push(`a.action ILIKE $${idx}`);
      params.push(`%${action}%`);
      idx++;
    }
    if (actor_id) {
      conditions.push(`a.actor_id = $${idx}`);
      params.push(actor_id);
      idx++;
    }
    if (resource_type) {
      conditions.push(`a.resource_type = $${idx}`);
      params.push(resource_type);
      idx++;
    }
    if (severity) {
      conditions.push(`a.severity = $${idx}`);
      params.push(severity);
      idx++;
    }
    if (category) {
      conditions.push(`a.category = $${idx}`);
      params.push(category);
      idx++;
    }
    if (success !== undefined && success !== null && success !== '') {
      conditions.push(`a.success = $${idx}`);
      params.push(success === 'true' || success === true);
      idx++;
    }
    if (from) {
      conditions.push(`a.created_at >= $${idx}`);
      params.push(from);
      idx++;
    }
    if (to) {
      conditions.push(`a.created_at <= $${idx}`);
      params.push(to);
      idx++;
    }

    return { conditions, params, nextIdx: idx };
  }

  async search(filters: AuditSearchFilters = {}): Promise<AuditEntryRow[]> {
    const { limit = 50, offset = 0, sort_column, sort_dir, ...rest } = filters;
    const { conditions, params, nextIdx } = this.#buildWhere(rest);
    const orderBy = this.#buildOrderBy(sort_column, sort_dir);
    params.push(limit, offset);
    const { rows } = await pool.query<AuditEntryRow>(
      `SELECT a.*,
              u.display_name AS actor_display_name,
              u.username     AS actor_username
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      params,
    );
    return rows;
  }

  async searchWithCount(filters: AuditSearchFilters = {}): Promise<{ rows: AuditEntryRow[]; total: number }> {
    const { limit = 50, offset = 0, sort_column, sort_dir, ...rest } = filters;
    const { conditions, params: baseParams, nextIdx } = this.#buildWhere(rest);
    const orderBy = this.#buildOrderBy(sort_column, sort_dir);

    const countParams = [...baseParams];
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE ${conditions.join(' AND ')}`,
      countParams,
    );
    const total = parseInt(countRows[0].total, 10);

    const rowParams = [...baseParams, limit, offset];
    const { rows } = await pool.query<AuditEntryRow>(
      `SELECT a.*,
              u.display_name AS actor_display_name,
              u.username     AS actor_username
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      rowParams,
    );

    return { rows, total };
  }
}

export default new AuditRepository();
