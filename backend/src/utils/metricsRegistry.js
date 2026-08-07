/** In-memory HTTP and DB query metrics (reset on process restart). */

const MAX_SAMPLES_PER_ROUTE = 100;
const MAX_RECENT_5XX = 20;
const WINDOW_MS = 60_000;

let totalRequests = 0;
let error4xx = 0;
let error5xx = 0;
const requestTimestamps = [];
const routeStats = new Map(); // routeLabel → { count, samples: number[] }
const recentErrors5xx = [];

let dbQueryTotal = 0;
const dbQueryTimestamps = [];

function normalizeRoute(method, path) {
  const normalized = path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
  return `${method} ${normalized}`;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)]);
}

function pruneWindow(timestamps, now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
}

function recordRequest({ method, path, statusCode, durationMs }) {
  const now = Date.now();
  totalRequests += 1;
  requestTimestamps.push(now);
  pruneWindow(requestTimestamps, now);

  if (statusCode >= 400 && statusCode < 500) error4xx += 1;
  if (statusCode >= 500) {
    error5xx += 1;
    recentErrors5xx.unshift({
      route: normalizeRoute(method, path),
      method,
      statusCode,
      timestamp: new Date(now).toISOString(),
      message: `HTTP ${statusCode}`,
    });
    if (recentErrors5xx.length > MAX_RECENT_5XX) {
      recentErrors5xx.length = MAX_RECENT_5XX;
    }
  }

  const routeLabel = normalizeRoute(method, path);
  if (!routeStats.has(routeLabel)) {
    routeStats.set(routeLabel, { count: 0, samples: [] });
  }
  const stat = routeStats.get(routeLabel);
  stat.count += 1;
  stat.samples.push(durationMs);
  if (stat.samples.length > MAX_SAMPLES_PER_ROUTE) {
    stat.samples.shift();
  }
}

function recordDbQuery() {
  const now = Date.now();
  dbQueryTotal += 1;
  dbQueryTimestamps.push(now);
  pruneWindow(dbQueryTimestamps, now);
}

function getQueriesPerSecond() {
  pruneWindow(dbQueryTimestamps);
  return Math.round((dbQueryTimestamps.length / (WINDOW_MS / 1000)) * 100) / 100;
}

function getDbQueryTotal() {
  return dbQueryTotal;
}

function getHttpMetrics() {
  pruneWindow(requestTimestamps);
  const allSamples = [];
  for (const stat of routeStats.values()) {
    allSamples.push(...stat.samples);
  }
  allSamples.sort((a, b) => a - b);

  const routes = [...routeStats.entries()]
    .map(([route, stat]) => {
      const sorted = [...stat.samples].sort((a, b) => a - b);
      const avgMs = sorted.length
        ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length)
        : 0;
      return {
        route,
        count: stat.count,
        avgMs,
        p95Ms: percentile(sorted, 95) ?? 0,
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms);

  const totalErrors = error4xx + error5xx;
  const errorRatePct = totalRequests > 0
    ? Math.round((totalErrors / totalRequests) * 10000) / 100
    : 0;

  return {
    totalRequests,
    requestsPerMinute: requestTimestamps.length,
    error4xx,
    error5xx,
    errorRatePct,
    latency: {
      p50: percentile(allSamples, 50),
      p95: percentile(allSamples, 95),
      p99: percentile(allSamples, 99),
    },
    routes,
    topRoutes: routes.slice(0, 10),
    recentErrors5xx: [...recentErrors5xx],
  };
}

/**
 * Estado crudo de esta instancia, pensado para combinarlo con el de las demás
 * (ver utils/clusterMetrics.js). Devuelve las muestras de latencia sin procesar
 * a propósito: los percentiles no se pueden promediar entre instancias, hay que
 * calcularlos sobre la unión de las muestras.
 */
function getSnapshot() {
  pruneWindow(requestTimestamps);
  return {
    totalRequests,
    requestsPerMinute: requestTimestamps.length,
    error4xx,
    error5xx,
    dbQueryTotal,
    queriesPerSecond: getQueriesPerSecond(),
    routes: [...routeStats.entries()].map(([route, stat]) => ({
      route,
      count: stat.count,
      samples: [...stat.samples],
    })),
    recentErrors5xx: [...recentErrors5xx],
  };
}

module.exports = {
  recordRequest,
  recordDbQuery,
  getHttpMetrics,
  getQueriesPerSecond,
  getDbQueryTotal,
  getSnapshot,
  percentile,
  MAX_RECENT_5XX,
};
