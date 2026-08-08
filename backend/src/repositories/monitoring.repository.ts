import { pool } from '../config/database';
import type { Row } from '../types/rows';

const RANGE_INTERVALS: Record<string, string> = {
  '1h': '1 hour',
  '6h': '6 hours',
  '24h': '24 hours',
  '7d': '7 days',
};

/** Fila de una instantánea, tal como la escribe el job de monitoreo. */
export interface SnapshotInput {
  host: string;
  procesoInicio: Date;
  heapPct: number;
  memSistemaPct: number;
  cpuProcesoPct: number;
  latenciaDbMs: number | null;
  poolOcupadas: number;
  poolMax: number;
  qps: number;
  requestsPorMin: number;
  errorRatePct: number;
}

export interface ConnectionDetail {
  session_id: number;
  program_name: string;
  host_name: string;
  status: string | null;
  database_name: string | null;
}

/**
 * No hereda de BaseRepository: consulta vistas del sistema (`pg_stat_activity`)
 * y la tabla de instantáneas, no una tabla propia con id.
 */
class MonitoringRepository {
  async getConnectionCount() {
    const { rows } = await pool.query<{ active_connections: number; total_connections: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active')::int AS active_connections,
        COUNT(*)::int AS total_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
    `);

    const { rows: details } = await pool.query<ConnectionDetail>(`
      SELECT
        pid AS session_id,
        COALESCE(application_name, '') AS program_name,
        COALESCE(client_addr::text, '') AS host_name,
        state AS status,
        datname AS database_name
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
      ORDER BY pid
      LIMIT 100
    `);

    return {
      active_connections: rows[0]?.active_connections ?? 0,
      total_connections: rows[0]?.total_connections ?? 0,
      connection_details: details,
    };
  }

  async getDatabaseSize(): Promise<{ size_mb: number }> {
    const { rows } = await pool.query<{ size_mb: string }>(`
      SELECT ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) AS size_mb
    `);
    return { size_mb: parseFloat(rows[0]?.size_mb ?? '0') };
  }

  async getWaitStats() {
    const { rows } = await pool.query<{
      wait_type: string;
      waiting_tasks_count: number;
      wait_time_ms: string;
    }>(`
      SELECT
        wait_event_type AS wait_type,
        COUNT(*)::int AS waiting_tasks_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (NOW() - state_change)) * 1000), 0)::bigint AS wait_time_ms
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event IS NOT NULL
        AND pid <> pg_backend_pid()
      GROUP BY wait_event_type
      ORDER BY wait_time_ms DESC
      LIMIT 10
    `);
    return rows;
  }

  async getCurrentWaits() {
    const { rows } = await pool.query<{ session_id: number; wait_type: string; wait_time: number }>(`
      SELECT
        pid AS session_id,
        wait_event_type AS wait_type,
        ROUND(EXTRACT(EPOCH FROM (NOW() - state_change)) * 1000)::int AS wait_time
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event IS NOT NULL
        AND state = 'active'
        AND pid <> pg_backend_pid()
      ORDER BY wait_time DESC
      LIMIT 20
    `);
    return rows;
  }

  async insertSnapshot(snapshot: SnapshotInput) {
    const { rows } = await pool.query<{ id: string; fecha_registro: Date }>(`
      INSERT INTO monitoring_snapshots (
        host, proceso_inicio, heap_pct, mem_sistema_pct, cpu_proceso_pct,
        latencia_db_ms, pool_ocupadas, pool_max, qps, requests_por_min, error_rate_pct
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, fecha_registro
    `, [
      snapshot.host,
      snapshot.procesoInicio,
      snapshot.heapPct,
      snapshot.memSistemaPct,
      snapshot.cpuProcesoPct,
      snapshot.latenciaDbMs,
      snapshot.poolOcupadas,
      snapshot.poolMax,
      snapshot.qps,
      snapshot.requestsPorMin,
      snapshot.errorRatePct,
    ]);
    return rows[0];
  }

  async getSnapshotHistory(range = '24h'): Promise<Row<'monitoring_snapshots'>[]> {
    const interval = RANGE_INTERVALS[range] || RANGE_INTERVALS['24h'];
    const { rows } = await pool.query<Row<'monitoring_snapshots'>>(`
      SELECT
        id,
        host,
        proceso_inicio,
        heap_pct,
        mem_sistema_pct,
        cpu_proceso_pct,
        latencia_db_ms,
        pool_ocupadas,
        pool_max,
        qps,
        requests_por_min,
        error_rate_pct,
        fecha_registro
      FROM monitoring_snapshots
      WHERE fecha_registro >= NOW() - $1::interval
      ORDER BY fecha_registro ASC
    `, [interval]);
    return rows;
  }

  async purgeOldSnapshots(retentionDays: number): Promise<{ deleted: number | null }> {
    const { rowCount } = await pool.query(`
      DELETE FROM monitoring_snapshots
      WHERE fecha_registro < NOW() - ($1 || ' days')::interval
    `, [String(retentionDays)]);
    return { deleted: rowCount };
  }
}

export = new MonitoringRepository();
