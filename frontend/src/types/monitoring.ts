/**
 * Contrato de /monitoring/*. Sin backend/src/models/*.model.ts propio — este
 * panel es sólo para super_admin, así que el backend arma la respuesta
 * directamente en backend/src/services/monitoring.service.ts (y sus vecinos:
 * config/socketStore.ts, utils/clusterMetrics.ts, utils/cronJobStatus.ts,
 * repositories/monitoring.repository.ts). Reconstruido leyendo esos archivos,
 * no generado desde un tipo ya exportado. Ver la nota de sincronización en
 * types/user.ts.
 */

export interface ServerInfo {
  status: string;
  startTime: string;
  uptime: number;
  uptimeFormatted: string;
  environment: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}

export interface ProcessMemory {
  rss: string;
  heapTotal: string;
  heapUsed: string;
  external: string;
  heapUsedRaw: number;
  heapTotalRaw: number;
  heapLimitRaw: number;
  heapLimit: string;
  heapUsedPercentage: number;
  heapLimitPercentage: number;
}

export interface ProcessCpuUsage {
  system: { usage: number };
  process: { user: number; system: number; usage: number };
}

export interface ProcessInfo {
  pid: number;
  ppid: number | undefined;
  title: string;
  memory: ProcessMemory;
  cpu: ProcessCpuUsage;
}

export interface SystemMetrics {
  hostname: string;
  platform: string;
  arch: string;
  cpus: { count: number; model?: string; speed?: number };
  memory: { total: string; free: string; used: string; usedPercentage: number };
  loadAverage: number[];
  loadAverageSupported: boolean;
  uptime: string;
}

export interface PoolStatus {
  connected: boolean;
  healthy: boolean;
  totalConnections: number;
  idleConnections: number;
  busyConnections: number;
  pendingRequests: number;
  maxConnections: number;
}

export interface DbConnectionTest {
  success: boolean;
  responseTime?: number;
  data?: unknown;
  error?: string;
}

export interface SystemStatus {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  reasons: string[];
  components: {
    server: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      reasons: string[];
      info: ServerInfo;
      process: ProcessInfo;
      system: SystemMetrics;
    };
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      reasons: string[];
      pool: PoolStatus;
      connection: DbConnectionTest;
    };
  };
}

export interface BuildInfo {
  version: string;
  environment: string;
  gitSha: string | null;
  gitShaFull: string | null;
  gitBranch: string | null;
  serverStartTime: string;
  processUptime: number;
  processUptimeFormatted: string;
}

export interface SocketMetrics {
  activeSockets: number;
  uniqueUsers: number;
}

export interface RouteStat {
  route: string;
  count: number;
  avgMs: number;
  p95Ms: number;
}

export interface HttpError5xx {
  route: string;
  method: string;
  statusCode: number;
  timestamp: string;
  message: string;
}

/** Agregado de todo el cluster (ver clusterMetrics.mergeHttp). */
export interface HttpMetrics {
  totalRequests: number;
  requestsPerMinute: number;
  error4xx: number;
  error5xx: number;
  errorRatePct: number;
  latency: { p50: number | null; p95: number | null; p99: number | null };
  routes: RouteStat[];
  topRoutes: RouteStat[];
  recentErrors5xx: HttpError5xx[];
  dbQueryTotal: number;
  queriesPerSecond: number;
}

export interface JobRun {
  descripcion: string;
  ultimaEjecucion: string;
  resultado: string;
  origen: string;
  /** Con varias instancias, cuál de ellas corrió esta ejecución. */
  instancia: string;
}

export interface CronWorkerStatus {
  enabled: boolean;
  running: boolean;
  ready: boolean;
  instancia: string;
  note: string;
}

export interface ConnectionDetail {
  session_id: number;
  program_name: string;
  host_name: string;
  status: string | null;
  database_name: string | null;
}

export interface ConnectionCount {
  active_connections: number;
  total_connections: number;
  connection_details: ConnectionDetail[];
}

export interface WaitStat {
  wait_type: string;
  waiting_tasks_count: number;
  /** COALESCE(SUM(...))::bigint — pg lo serializa como string. */
  wait_time_ms: string;
}

export interface CurrentWait {
  session_id: number;
  wait_type: string;
  wait_time: number;
}

/** GET /monitoring/database */
export interface DetailedPoolStats {
  poolStatus: PoolStatus;
  connectionCount: ConnectionCount;
  databaseSize: { size_mb: number };
  waitStats: {
    cumulativeSinceServerStart: WaitStat[];
    note: string;
  };
  currentWaits: CurrentWait[];
}

/** Fila de `monitoring_snapshots` — columnas numeric/bigint de Postgres viajan como string. */
export interface MonitoringSnapshot {
  id: string;
  host: string;
  fecha_registro: string;
  proceso_inicio: string;
  heap_pct: number | null;
  mem_sistema_pct: number | null;
  cpu_proceso_pct: string | null;
  latencia_db_ms: string | null;
  pool_ocupadas: number | null;
  pool_max: number | null;
  qps: string | null;
  requests_por_min: number | null;
  error_rate_pct: string | null;
}

/** GET /monitoring/dashboard */
export interface DashboardData extends SystemStatus {
  databaseDetails: DetailedPoolStats;
  cronJobs: Record<string, JobRun>;
  cronWorker: CronWorkerStatus;
  instancias: number;
  http: HttpMetrics;
  socket: SocketMetrics;
  build: BuildInfo;
  performance: { queriesPerSecond: number; dbQueryTotal: number };
  recentHistory: MonitoringSnapshot[];
}

/** GET /monitoring/system */
export interface SystemMetricsResponse {
  server: ServerInfo;
  process: ProcessInfo;
  system: SystemMetrics;
  database: PoolStatus;
  instancias: number;
  http: HttpMetrics;
  socket: SocketMetrics;
  performance: { queriesPerSecond: number; dbQueryTotal: number };
  build: BuildInfo;
}

/** GET /monitoring/history?range= */
export type SnapshotHistory = MonitoringSnapshot[];
