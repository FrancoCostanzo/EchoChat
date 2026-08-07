/**
 * Combina las métricas de todas las instancias del backend.
 *
 * `metricsRegistry` y `cronJobStatus` viven en memoria de cada proceso, así que
 * con N instancias el panel mostraría sólo las de la que atendió el request.
 * Con los jobs eso pasó de ser impreciso a estar mal: desde la Fase 3 cada
 * corrida la ejecuta UNA instancia, con lo que las demás no tienen historial
 * que mostrar.
 *
 * La recolección va por `serverSideEmitWithAck` del adapter de Socket.IO: no
 * necesita claves extra en Redis ni un job que publique snapshots, y los datos
 * son del momento en que se consulta.
 */

const config = require('../config');
const logger = require('../config/logger');
const metricsRegistry = require('./metricsRegistry');
const { getJobRuns } = require('./cronJobStatus');

const EVENT = 'metrics:collect';
const ACK_TIMEOUT_MS = 1500;

/** Lo que esta instancia aporta al total. */
function localSnapshot() {
  return {
    instancia: config.instanceId,
    http: metricsRegistry.getSnapshot(),
    cronJobs: getJobRuns(),
  };
}

// socket.js nos pasa el servidor al inicializar; antes lo buscábamos con un
// require perezoso de '../socket', que cerraba un ciclo.
let servidor = null;

/** Responde a las consultas de métricas que llegan de otras instancias. */
function registerCollector(io) {
  servidor = io;
  io.on(EVENT, (respond) => {
    if (typeof respond === 'function') respond(localSnapshot());
  });
}

function mergeCronJobs(snapshots) {
  const merged = {};
  for (const snap of snapshots) {
    for (const [name, run] of Object.entries(snap.cronJobs || {})) {
      // Si dos instancias ejecutaron el mismo job en momentos distintos, vale
      // la corrida más reciente.
      const previa = merged[name];
      if (!previa || String(run.ultimaEjecucion) > String(previa.ultimaEjecucion)) {
        merged[name] = run;
      }
    }
  }
  return merged;
}

function mergeHttp(snapshots) {
  const total = {
    totalRequests: 0,
    requestsPerMinute: 0,
    error4xx: 0,
    error5xx: 0,
    dbQueryTotal: 0,
    queriesPerSecond: 0,
  };
  const routes = new Map(); // route → { count, samples: [] }
  const errores = [];

  for (const snap of snapshots) {
    const http = snap.http || {};
    total.totalRequests += http.totalRequests || 0;
    total.requestsPerMinute += http.requestsPerMinute || 0;
    total.error4xx += http.error4xx || 0;
    total.error5xx += http.error5xx || 0;
    total.dbQueryTotal += http.dbQueryTotal || 0;
    total.queriesPerSecond += http.queriesPerSecond || 0;

    for (const { route, count, samples } of http.routes || []) {
      if (!routes.has(route)) routes.set(route, { count: 0, samples: [] });
      const acc = routes.get(route);
      acc.count += count || 0;
      acc.samples.push(...(samples || []));
    }
    errores.push(...(http.recentErrors5xx || []));
  }

  // Percentiles sobre la unión de muestras: promediar los percentiles de cada
  // instancia daría un número que no corresponde a ninguna petición real.
  const todas = [];
  for (const acc of routes.values()) todas.push(...acc.samples);
  todas.sort((a, b) => a - b);

  const porRuta = [...routes.entries()]
    .map(([route, acc]) => {
      const ordenadas = [...acc.samples].sort((a, b) => a - b);
      const avgMs = ordenadas.length
        ? Math.round(ordenadas.reduce((s, v) => s + v, 0) / ordenadas.length)
        : 0;
      return {
        route,
        count: acc.count,
        avgMs,
        p95Ms: metricsRegistry.percentile(ordenadas, 95) ?? 0,
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms);

  const totalErrores = total.error4xx + total.error5xx;

  return {
    totalRequests: total.totalRequests,
    requestsPerMinute: total.requestsPerMinute,
    error4xx: total.error4xx,
    error5xx: total.error5xx,
    errorRatePct: total.totalRequests > 0
      ? Math.round((totalErrores / total.totalRequests) * 10000) / 100
      : 0,
    latency: {
      p50: metricsRegistry.percentile(todas, 50),
      p95: metricsRegistry.percentile(todas, 95),
      p99: metricsRegistry.percentile(todas, 99),
    },
    routes: porRuta,
    topRoutes: porRuta.slice(0, 10),
    recentErrors5xx: errores
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, metricsRegistry.MAX_RECENT_5XX),
    // Datos agregados de todo el cluster.
    dbQueryTotal: total.dbQueryTotal,
    queriesPerSecond: Math.round(total.queriesPerSecond * 100) / 100,
  };
}

/**
 * Métricas de todo el cluster. Si no hay otras instancias (o no contestan a
 * tiempo) devuelve las locales, que es exactamente el comportamiento anterior.
 */
async function gather() {
  const snapshots = [localSnapshot()];
  let instancias = 1;

  if (!servidor) return { instancias, http: mergeHttp(snapshots), cronJobs: mergeCronJobs(snapshots) };

  try {
    // serverSideEmitWithAck vive en el Server (io.timeout() devuelve un
    // BroadcastOperator, que no lo tiene) y no acepta timeout, así que le
    // ponemos uno propio: el panel no debe quedar colgado por una instancia
    // que no contesta.
    const respuestas = await Promise.race([
      servidor.serverSideEmitWithAck(EVENT),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ACK_TIMEOUT_MS)),
    ]);
    for (const respuesta of respuestas) {
      if (respuesta && respuesta.http) {
        snapshots.push(respuesta);
        instancias += 1;
      }
    }
  } catch (err) {
    // Sin adapter Redis no hay otras instancias que consultar; si alguna no
    // contestó, mostramos lo que tenemos en vez de romper el panel.
    logger.debug({ err: err.message }, 'No se pudieron recolectar métricas de otras instancias');
  }

  return {
    instancias,
    http: mergeHttp(snapshots),
    cronJobs: mergeCronJobs(snapshots),
  };
}

module.exports = { registerCollector, gather, localSnapshot, mergeHttp, mergeCronJobs };
