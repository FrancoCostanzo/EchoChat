const { pool } = require('../config/database');

const RANGE_INTERVALS = {
  '1h': '1 hour',
  '6h': '6 hours',
  '24h': '24 hours',
  '7d': '7 days',
};

class MonitoringRepository {
  async getConnectionCount() {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active')::int AS active_connections,
        COUNT(*)::int AS total_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
    `);

    const { rows: details } = await pool.query(`
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

  async getDatabaseSize() {
    const { rows } = await pool.query(`
      SELECT ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) AS size_mb
    `);
    return { size_mb: parseFloat(rows[0]?.size_mb ?? 0) };
  }

  async getWaitStats() {
    const { rows } = await pool.query(`
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
    const { rows } = await pool.query(`
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

  async insertSnapshot(snapshot) {
    const { rows } = await pool.query(`
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

  async getSnapshotHistory(range = '24h') {
    const interval = RANGE_INTERVALS[range] || RANGE_INTERVALS['24h'];
    const { rows } = await pool.query(`
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

  async purgeOldSnapshots(retentionDays) {
    const { rowCount } = await pool.query(`
      DELETE FROM monitoring_snapshots
      WHERE fecha_registro < NOW() - ($1 || ' days')::interval
    `, [String(retentionDays)]);
    return { deleted: rowCount };
  }
}

module.exports = new MonitoringRepository();
