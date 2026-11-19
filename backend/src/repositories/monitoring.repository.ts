import { sql } from 'kysely';
import { db } from '../config/db';
import { nowMinus, type IntervalUnit } from '../config/db/sql';
import type { Row } from '../types/rows';

const RANGE_INTERVALS: Record<string, [number, IntervalUnit]> = {
  '1h': [1, 'hours'],
  '6h': [6, 'hours'],
  '24h': [24, 'hours'],
  '7d': [7, 'days'],
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
 *
 * Las vistas del sistema son propias de cada motor: estas consultas son de
 * PostgreSQL y en la etapa 5 de docs/MULTI_DB.md se suma la versión de SQL
 * Server (`sys.dm_exec_sessions`).
 */
class MonitoringRepository {
  async getConnectionCount() {
    const { rows } = await sql<{ active_connections: number; total_connections: number }>`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active')::int AS active_connections,
        COUNT(*)::int AS total_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
    `.execute(db);

    const { rows: details } = await sql<ConnectionDetail>`
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
    `.execute(db);

    return {
      active_connections: rows[0]?.active_connections ?? 0,
      total_connections: rows[0]?.total_connections ?? 0,
      connection_details: details,
    };
  }

  async getDatabaseSize(): Promise<{ size_mb: number }> {
    const { rows } = await sql<{ size_mb: string }>`
      SELECT ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) AS size_mb
    `.execute(db);
    return { size_mb: parseFloat(rows[0]?.size_mb ?? '0') };
  }

  async getWaitStats() {
    const { rows } = await sql<{
      wait_type: string;
      waiting_tasks_count: number;
      wait_time_ms: string;
    }>`
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
    `.execute(db);
    return rows;
  }

  async getCurrentWaits() {
    const { rows } = await sql<{ session_id: number; wait_type: string; wait_time: number }>`
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
    `.execute(db);
    return rows;
  }

  async insertSnapshot(snapshot: SnapshotInput) {
    return db.insertInto('monitoring_snapshots')
      .values({
        host: snapshot.host,
        proceso_inicio: snapshot.procesoInicio,
        heap_pct: snapshot.heapPct,
        mem_sistema_pct: snapshot.memSistemaPct,
        cpu_proceso_pct: snapshot.cpuProcesoPct,
        latencia_db_ms: snapshot.latenciaDbMs,
        pool_ocupadas: snapshot.poolOcupadas,
        pool_max: snapshot.poolMax,
        qps: snapshot.qps,
        requests_por_min: snapshot.requestsPorMin,
        error_rate_pct: snapshot.errorRatePct,
      })
      .returning(['id', 'fecha_registro'])
      .executeTakeFirst() as Promise<{ id: string; fecha_registro: Date }>;
  }

  async getSnapshotHistory(range = '24h'): Promise<Row<'monitoring_snapshots'>[]> {
    const [amount, unit] = RANGE_INTERVALS[range] || RANGE_INTERVALS['24h'];
    return db.selectFrom('monitoring_snapshots')
      .select([
        'id', 'host', 'proceso_inicio', 'heap_pct', 'mem_sistema_pct', 'cpu_proceso_pct',
        'latencia_db_ms', 'pool_ocupadas', 'pool_max', 'qps', 'requests_por_min', 'error_rate_pct',
        'fecha_registro',
      ])
      .where('fecha_registro', '>=', nowMinus(amount, unit))
      .orderBy('fecha_registro', 'asc')
      .execute() as unknown as Promise<Row<'monitoring_snapshots'>[]>;
  }

  async purgeOldSnapshots(retentionDays: number): Promise<{ deleted: number | null }> {
    const result = await db.deleteFrom('monitoring_snapshots')
      .where('fecha_registro', '<', nowMinus(retentionDays, 'days'))
      .executeTakeFirst();
    return { deleted: Number(result.numDeletedRows) };
  }
}

export default new MonitoringRepository();
