import os from 'os';
import v8 from 'v8';
import path from 'path';
import { readFileSync } from 'fs';
import { performance } from 'perf_hooks';
import config from '../config';
import { pool } from '../config/database';
import { getSocketMetrics } from '../config/socketStore';
import monitoringRepository from '../repositories/monitoring.repository';
import * as metricsRegistry from '../utils/metricsRegistry';
import { monitoringThresholds } from '../utils/monitoringThresholds';
import { getCronWorkerStatus } from '../utils/cronJobStatus';
import * as clusterMetrics from '../utils/clusterMetrics';
import type { SnapshotInput } from '../repositories/monitoring.repository';

/** Muestra de CPU con la que se calcula el uso entre dos llamadas. */
interface CpuSample {
  totalIdle: number;
  totalTick: number;
  time: number;
  processCpu: NodeJS.CpuUsage;
}

/**
 * Resultado del ping a la base. Un solo tipo con campos opcionales en vez de un
 * union: los llamadores leen `responseTime` sin estrechar por `success`, que es
 * justamente lo que un union prohibiría.
 */
interface DbConnectionTest {
  success: boolean;
  responseTime?: number;
  data?: unknown;
  error?: string;
}

type EstadoSalud = 'healthy' | 'degraded' | 'unhealthy';

let packageVersion = 'unknown';
try {
  const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));
  packageVersion = pkg.version;
} catch {
  // ignorar
}

let gitSha: string | null = process.env.MONITORING_GIT_SHA || null;
let gitBranch: string | null = null;
try {
  const gitDir = path.resolve(__dirname, '../../../.git');
  const head = readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim();
  if (head.startsWith('ref:')) {
    const ref = head.slice(4).trim();
    gitBranch = ref.replace('refs/heads/', '');
    if (!gitSha) {
      try {
        gitSha = readFileSync(path.join(gitDir, ref), 'utf-8').trim();
      } catch {
        const packed = readFileSync(path.join(gitDir, 'packed-refs'), 'utf-8');
        const line = packed.split('\n').find((l) => l.endsWith(` ${ref}`));
        if (line) gitSha = line.split(' ')[0];
      }
    }
  } else if (!gitSha) {
    gitSha = head;
  }
} catch {
  // sin repo git
}
const gitShaShort = gitSha ? gitSha.slice(0, 7) : null;

class MonitoringService {
  serverStartTime: Date;
  lastSystemCpuUsage: CpuSample | null;

  constructor() {
    this.serverStartTime = new Date();
    this.lastSystemCpuUsage = null;
    this._primeCpuMeasurement();
  }

  async getDashboard() {
    const [health, databaseDetails, history, cluster] = await Promise.all([
      this.getCompleteSystemStatus(),
      this.getDetailedPoolStats(),
      monitoringRepository.getSnapshotHistory('1h').catch(() => []),
      clusterMetrics.gather(),
    ]);

    return {
      ...health,
      databaseDetails,
      // Agregado de todas las instancias: con los jobs corriendo en una sola,
      // consultar el panel contra otra mostraría el historial vacío.
      cronJobs: cluster.cronJobs,
      cronWorker: getCronWorkerStatus(),
      instancias: cluster.instancias,
      http: cluster.http,
      socket: await this._getSocketMetrics(),
      build: this._getBuildInfo(),
      performance: {
        queriesPerSecond: cluster.http.queriesPerSecond,
        dbQueryTotal: cluster.http.dbQueryTotal,
      },
      recentHistory: Array.isArray(history) ? history.slice(-12) : [],
    };
  }

  async getCompleteSystemStatus() {
    const serverInfo = this._getServerInfo();
    const processInfo = this._getProcessInfo();
    const systemMetrics = this._getSystemMetrics();
    const poolStatus = this._getPoolStatus();
    const connectionTest = await this._testDatabaseConnection();

    const evaluation = this._evaluateHealth({
      processInfo,
      systemMetrics,
      poolStatus,
      connectionTest,
    });

    return {
      overallStatus: evaluation.overallStatus,
      reasons: evaluation.reasons,
      components: {
        server: {
          status: evaluation.serverStatus,
          reasons: evaluation.serverReasons,
          info: serverInfo,
          process: processInfo,
          system: systemMetrics,
        },
        database: {
          status: evaluation.databaseStatus,
          reasons: evaluation.databaseReasons,
          pool: poolStatus,
          connection: connectionTest,
        },
      },
    };
  }

  async getSystemMetrics() {
    // `server`, `process` y `system` son de ESTA instancia (memoria, CPU, uptime
    // del proceso); `http` y `socket` son de todo el cluster.
    const cluster = await clusterMetrics.gather();
    return {
      server: this._getServerInfo(),
      process: this._getProcessInfo(),
      system: this._getSystemMetrics(),
      database: this._getPoolStatus(),
      instancias: cluster.instancias,
      http: cluster.http,
      socket: await this._getSocketMetrics(),
      performance: {
        queriesPerSecond: cluster.http.queriesPerSecond,
        dbQueryTotal: cluster.http.dbQueryTotal,
      },
      build: this._getBuildInfo(),
    };
  }

  async getDetailedPoolStats() {
    const poolStatus = this._getPoolStatus();

    const [connectionCount, databaseSize, waitStats, currentWaits] = await Promise.all([
      monitoringRepository.getConnectionCount(),
      monitoringRepository.getDatabaseSize(),
      monitoringRepository.getWaitStats(),
      monitoringRepository.getCurrentWaits(),
    ]);

    return {
      poolStatus,
      connectionCount,
      databaseSize,
      waitStats: {
        cumulativeSinceServerStart: waitStats,
        note: 'pg_stat_activity refleja el estado actual de sesiones PostgreSQL (no acumulado desde arranque del servidor DB).',
      },
      currentWaits,
    };
  }

  getLiveness() {
    return {
      status: 'alive',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const poolStatus = this._getPoolStatus();
    const connectionTest = await this._testDatabaseConnection();
    const cronWorker = getCronWorkerStatus();

    const dbReady = connectionTest.success && poolStatus.connected && poolStatus.healthy;
    const cronReady = !cronWorker.enabled || cronWorker.ready;

    const ready = dbReady && cronReady;
    const reasons: string[] = [];
    if (!connectionTest.success) reasons.push('db_connection_failed');
    if (!poolStatus.connected) reasons.push('pool_disconnected');
    if (!poolStatus.healthy) reasons.push('pool_unhealthy');
    if (cronWorker.enabled && !cronWorker.ready) reasons.push('cron_worker_not_ready');

    return {
      status: ready ? 'ready' : 'not_ready',
      ready,
      reasons,
      database: { connected: poolStatus.connected, healthy: poolStatus.healthy },
      cronWorker,
    };
  }

  async getSnapshotHistory(range = '24h') {
    return monitoringRepository.getSnapshotHistory(range);
  }

  async collectSnapshot() {
    const processInfo = this._getProcessInfo();
    const systemMetrics = this._getSystemMetrics();
    const poolStatus = this._getPoolStatus();
    const connectionTest = await this._testDatabaseConnection();
    const http = metricsRegistry.getHttpMetrics();

    const snapshot: SnapshotInput = {
      host: os.hostname(),
      procesoInicio: this.serverStartTime,
      heapPct: processInfo.memory.heapLimitPercentage,
      memSistemaPct: systemMetrics.memory.usedPercentage,
      cpuProcesoPct: processInfo.cpu.process.usage,
      latenciaDbMs: connectionTest.responseTime ?? null,
      poolOcupadas: poolStatus.busyConnections,
      poolMax: poolStatus.maxConnections || poolStatus.totalConnections,
      qps: metricsRegistry.getQueriesPerSecond(),
      requestsPorMin: http.requestsPerMinute,
      errorRatePct: http.errorRatePct,
    };

    const insertResult = await monitoringRepository.insertSnapshot(snapshot);
    const purgeResult = await monitoringRepository.purgeOldSnapshots(
      monitoringThresholds.snapshotRetentionDays,
    );

    return { snapshot, insertResult, purgeResult };
  }

  _evaluateHealth({ processInfo, systemMetrics, poolStatus, connectionTest }: {
    processInfo: ReturnType<MonitoringService['_getProcessInfo']>;
    systemMetrics: ReturnType<MonitoringService['_getSystemMetrics']>;
    poolStatus: ReturnType<MonitoringService['_getPoolStatus']>;
    connectionTest: DbConnectionTest;
  }) {
    const reasons: string[] = [];
    const serverReasons: string[] = [];
    const databaseReasons: string[] = [];
    const t = monitoringThresholds;

    let serverStatus: EstadoSalud = 'healthy';
    let databaseStatus: EstadoSalud = 'healthy';

    const heapPct = processInfo.memory.heapLimitPercentage;
    if (heapPct >= t.heapUnhealthyPct) {
      serverStatus = 'unhealthy';
      serverReasons.push('heap_high');
      reasons.push('heap_high');
    } else if (heapPct >= t.heapDegradedPct) {
      serverStatus = 'degraded';
      serverReasons.push('heap_elevated');
      reasons.push('heap_elevated');
    }

    const sysMemPct = systemMetrics.memory.usedPercentage;
    if (sysMemPct >= t.sysMemUnhealthyPct) {
      serverStatus = 'unhealthy';
      serverReasons.push('system_memory_high');
      reasons.push('system_memory_high');
    } else if (sysMemPct >= t.sysMemDegradedPct && serverStatus === 'healthy') {
      serverStatus = 'degraded';
      serverReasons.push('system_memory_elevated');
      reasons.push('system_memory_elevated');
    }

    const cpuPct = processInfo.cpu.process.usage;
    if (cpuPct >= t.cpuUnhealthyPct) {
      serverStatus = 'unhealthy';
      serverReasons.push('cpu_high');
      reasons.push('cpu_high');
    } else if (cpuPct >= t.cpuDegradedPct && serverStatus === 'healthy') {
      serverStatus = 'degraded';
      serverReasons.push('cpu_elevated');
      reasons.push('cpu_elevated');
    }

    if (!connectionTest.success || !poolStatus.connected) {
      databaseStatus = 'unhealthy';
      databaseReasons.push('db_connection_failed');
      reasons.push('db_connection_failed');
    } else {
      const latency = connectionTest.responseTime ?? 0;
      if (latency >= t.dbLatencyUnhealthyMs) {
        databaseStatus = 'unhealthy';
        databaseReasons.push('db_latency_high');
        reasons.push('db_latency_high');
      } else if (latency >= t.dbLatencyDegradedMs) {
        databaseStatus = 'degraded';
        databaseReasons.push('db_latency_elevated');
        reasons.push('db_latency_elevated');
      }

      const maxConn = poolStatus.maxConnections || 1;
      const saturation = (poolStatus.busyConnections / maxConn) * 100;
      if (saturation >= t.poolSaturationPct) {
        if (databaseStatus === 'healthy') databaseStatus = 'degraded';
        databaseReasons.push('pool_saturated');
        reasons.push('pool_saturated');
      }
    }

    let overallStatus: EstadoSalud = 'healthy';
    if (serverStatus === 'unhealthy' || databaseStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (serverStatus === 'degraded' || databaseStatus === 'degraded') {
      overallStatus = 'degraded';
    }

    return {
      overallStatus,
      reasons,
      serverStatus,
      serverReasons,
      databaseStatus,
      databaseReasons,
    };
  }

  _getPoolStatus() {
    const totalConnections = pool.totalCount;
    const idleConnections = pool.idleCount;
    const busyConnections = totalConnections - idleConnections;
    const maxConnections = config.db.max;

    return {
      connected: true,
      healthy: pool.waitingCount < maxConnections,
      totalConnections,
      idleConnections,
      busyConnections,
      pendingRequests: pool.waitingCount,
      maxConnections,
    };
  }

  _primeCpuMeasurement(): CpuSample {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    this.lastSystemCpuUsage = {
      totalIdle,
      totalTick,
      time: Date.now(),
      processCpu: process.cpuUsage(),
    };
    return this.lastSystemCpuUsage;
  }

  _calculateSystemCpuUsage() {
    const cpus = os.cpus();
    const currentTime = Date.now();

    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    // En la primera llamada todavía no hay muestra previa contra la cual medir.
    const previa = this.lastSystemCpuUsage ?? this._primeCpuMeasurement();

    const idleDiff = totalIdle - previa.totalIdle;
    const totalDiff = totalTick - previa.totalTick;
    const systemCpuPercentage = totalDiff > 0 ? (100 - (100 * idleDiff / totalDiff)) : 0;

    const currentProcessCpu = process.cpuUsage();
    const timeDiffMs = currentTime - previa.time;

    const processUserDiff = currentProcessCpu.user - previa.processCpu.user;
    const processSystemDiff = currentProcessCpu.system - previa.processCpu.system;
    const processTotalDiff = processUserDiff + processSystemDiff;

    const timeDiffMicro = timeDiffMs * 1000;
    const processCpuPercentage = timeDiffMicro > 0 ? (processTotalDiff / timeDiffMicro) * 100 : 0;

    this.lastSystemCpuUsage = {
      totalIdle,
      totalTick,
      time: currentTime,
      processCpu: currentProcessCpu,
    };

    return {
      system: {
        usage: Math.round(Math.max(0, Math.min(100, systemCpuPercentage)) * 100) / 100,
      },
      process: {
        user: currentProcessCpu.user,
        system: currentProcessCpu.system,
        usage: Math.round(Math.max(0, Math.min(100, processCpuPercentage)) * 100) / 100,
      },
    };
  }

  _getServerInfo() {
    return {
      status: 'running',
      startTime: this.serverStartTime,
      uptime: process.uptime(),
      uptimeFormatted: this._formatUptime(process.uptime()),
      environment: config.env,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  }

  _getProcessInfo() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapLimitRaw = heapStats.heap_size_limit;
    const heapLimitPercentage = heapLimitRaw > 0
      ? Math.round((memUsage.heapUsed / heapLimitRaw) * 100)
      : 0;
    const cpuData = this._calculateSystemCpuUsage();

    return {
      pid: process.pid,
      ppid: process.ppid,
      title: process.title,
      memory: {
        rss: this._formatBytes(memUsage.rss),
        heapTotal: this._formatBytes(memUsage.heapTotal),
        heapUsed: this._formatBytes(memUsage.heapUsed),
        external: this._formatBytes(memUsage.external),
        heapUsedRaw: memUsage.heapUsed,
        heapTotalRaw: memUsage.heapTotal,
        heapLimitRaw,
        heapLimit: this._formatBytes(heapLimitRaw),
        heapUsedPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        heapLimitPercentage,
      },
      cpu: cpuData,
    };
  }

  _getSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: {
        count: cpus.length,
        model: cpus[0]?.model,
        speed: cpus[0]?.speed,
      },
      memory: {
        total: this._formatBytes(totalMem),
        free: this._formatBytes(freeMem),
        used: this._formatBytes(usedMem),
        usedPercentage: Math.round((usedMem / totalMem) * 100),
      },
      loadAverage: os.loadavg(),
      loadAverageSupported: os.platform() !== 'win32',
      uptime: this._formatUptime(os.uptime()),
    };
  }

  // Async: consulta a todas las instancias del cluster vía el adapter.
  async _getSocketMetrics() {
    return getSocketMetrics();
  }

  _getBuildInfo() {
    return {
      version: packageVersion,
      environment: config.env,
      gitSha: gitShaShort,
      gitShaFull: gitSha,
      gitBranch,
      serverStartTime: this.serverStartTime,
      processUptime: process.uptime(),
      processUptimeFormatted: this._formatUptime(process.uptime()),
    };
  }

  async _testDatabaseConnection(): Promise<DbConnectionTest> {
    try {
      const startTime = performance.now();
      const { rows } = await pool.query('SELECT 1 AS test, NOW() AS timestamp');
      const responseTime = performance.now() - startTime;

      return {
        success: true,
        responseTime: Math.round(responseTime * 100) / 100,
        data: rows[0],
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  _formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / 1024 ** i * 100) / 100} ${sizes[i]}`;
  }

  _formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }
}

export default new MonitoringService();
