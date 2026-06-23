-- Snapshots históricos de métricas del sistema (collector cada ~5 min)
CREATE TABLE IF NOT EXISTS monitoring_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    host            VARCHAR(255) NOT NULL,
    proceso_inicio  TIMESTAMPTZ NOT NULL,
    heap_pct        SMALLINT,
    mem_sistema_pct SMALLINT,
    cpu_proceso_pct NUMERIC(5, 2),
    latencia_db_ms  NUMERIC(10, 2),
    pool_ocupadas   SMALLINT,
    pool_max        SMALLINT,
    qps             NUMERIC(10, 2),
    requests_por_min INTEGER,
    error_rate_pct  NUMERIC(5, 2),
    fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_snapshots_fecha
    ON monitoring_snapshots (fecha_registro DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_snapshots_host_fecha
    ON monitoring_snapshots (host, fecha_registro DESC);
