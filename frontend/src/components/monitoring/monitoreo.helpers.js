import monitoreoServices from '@/services/monitoring/monitoring.service';

export const formatMicroseconds = (value) => {
  if (typeof value !== 'number') return 'N/A';
  if (value > 1000000) return `${(value / 1000000).toFixed(2)} s`;
  if (value > 1000) return `${(value / 1000).toFixed(2)} ms`;
  return `${value.toFixed(2)} μs`;
};

export const STATUS_BG_CLASSES = {
  success: 'bg-success-50 dark:bg-success-900/20',
  warning: 'bg-warning-50 dark:bg-warning-900/20',
  danger: 'bg-danger-50 dark:bg-danger-900/20',
  default: 'bg-default-100',
};

export const STATUS_TEXT_CLASSES = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  default: 'text-default-500',
};

export const getStatusColor = (status) => monitoreoServices.getStatusColor(status);

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

export const parseHttpRoute = (routeLabel) => {
  if (!routeLabel || routeLabel === '—') return { method: null, path: '—' };
  const match = String(routeLabel).match(/^(\w+)\s+(.+)$/);
  if (match && HTTP_METHODS.has(match[1].toUpperCase())) {
    return { method: match[1].toUpperCase(), path: match[2] };
  }
  return { method: null, path: routeLabel };
};

export const getHttpMethodColor = (method) => {
  switch (method?.toUpperCase()) {
    case 'GET': return 'primary';
    case 'POST': return 'success';
    case 'PUT': return 'warning';
    case 'PATCH': return 'secondary';
    case 'DELETE': return 'danger';
    case 'OPTIONS':
    case 'HEAD':
      return 'default';
    default:
      return 'default';
  }
};

export const sortItems = (items, sortDescriptor, getValue) => {
  if (!sortDescriptor?.column) return items;
  const { column, direction } = sortDescriptor;
  const factor = direction === 'descending' ? -1 : 1;

  return [...items].sort((a, b) => {
    const av = getValue(a, column);
    const bv = getValue(b, column);
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * factor;
    }
    return String(av ?? '').localeCompare(String(bv ?? ''), 'es', { numeric: true }) * factor;
  });
};

/** Textos de ayuda para métricas del dashboard de monitoreo */
export const MONITOREO_TOOLTIPS = {
  estadoGeneral: 'Evaluación global del servidor y la base de datos según umbrales configurables (memoria, CPU, latencia DB, saturación del pool).',
  uptime: 'Tiempo transcurrido desde que el proceso Node.js del backend se inició.',
  poolDb: 'Conexiones ocupadas del pool de PostgreSQL sobre el total activo. Formato: ocupadas/total.',
  heap: 'Porcentaje del heap de Node.js respecto al límite máximo de V8 (~2 GB en 64 bits). No confundir con el ratio usado/total del segmento actual, que suele estar alto.',
  actualizacion: 'Hora de la última lectura de datos en este panel. Depende del intervalo de refresh seleccionado.',

  p50: 'Percentil 50 (mediana): la mitad de las peticiones HTTP respondieron en este tiempo o menos. Representa la experiencia típica.',
  p95: 'Percentil 95: el 95 % de las peticiones respondieron en este tiempo o menos. Útil para detectar lentitud en picos sin mirar solo el promedio.',
  p99: 'Percentil 99: el 99 % de las peticiones respondieron en este tiempo o menos. Muestra los casos más lentos, cercanos al peor escenario.',
  latenciaHttp: 'Tiempos de respuesta de las peticiones HTTP medidos en memoria desde el arranque del servidor.',
  totalRequests: 'Cantidad total de peticiones HTTP recibidas desde que arrancó el backend. Se reinicia al reiniciar el proceso.',
  reqPorMin: 'Peticiones recibidas en el último minuto (ventana deslizante de 60 segundos).',
  errorRate: 'Porcentaje de respuestas con error (4xx + 5xx) sobre el total de peticiones desde el arranque.',
  errores5xx: 'Cantidad de respuestas HTTP 5xx (error interno del servidor) desde el arranque.',
  rutasLentas: 'Endpoints con mayor latencia en el percentil 95. Los datos viven en memoria y se agrupan por ruta normalizada.',
  muestras: 'Cantidad de mediciones de latencia registradas para esa ruta (máximo 100 por ruta en memoria).',
  avg: 'Tiempo de respuesta promedio de las muestras registradas para esa ruta.',
  qps: 'Consultas SQL por segundo en la ventana del último minuto.',
  heapPct: 'Porcentaje del heap respecto al límite máximo de V8 en el momento del snapshot.',
  memSistemaPct: 'Porcentaje de memoria RAM del sistema operativo en uso al momento del snapshot.',
  cpuProcesoPct: 'Uso de CPU del proceso Node.js al momento del snapshot.',
  latenciaDbMs: 'Tiempo de respuesta de un SELECT 1 al momento de guardar el snapshot.',
  requestsPorMin: 'Peticiones HTTP por minuto (ventana de 60 s) al momento del snapshot.',
  errorRatePct: 'Porcentaje de errores HTTP al momento del snapshot.',

  conexionesTotales: 'Conexiones abiertas en el pool de pg respecto al máximo configurado.',
  conexionesOcupadas: 'Conexiones del pool actualmente en uso ejecutando consultas.',
  conexionesLibres: 'Conexiones del pool disponibles para nuevas consultas.',
  peticionesEspera: 'Peticiones esperando que se libere una conexión del pool.',
  tiempoRespuestaDb: 'Latencia de una consulta de prueba (SELECT 1) a PostgreSQL en este instante.',
  tamanoBd: 'Tamaño total de la base de datos en megabytes.',
  consultasSeg: 'Promedio de consultas SQL por segundo en el último minuto.',
  waitStatsAcum: 'Esperas agrupadas por tipo en pg_stat_activity (estado actual de sesiones).',
  waitsActuales: 'Sesiones de PostgreSQL que están esperando ahora mismo (tiempo real).',

  memoriaSistema: 'RAM del servidor operativo en uso. Incluye todos los procesos, no solo Node.js.',
  cargaPromedio: 'Promedio de procesos en cola de CPU (1m, 5m, 15m). En Windows Node.js no expone este dato y verás "No disponible".',
  heapUsado: 'Memoria heap de objetos JavaScript. El segmento actual suele verse casi lleno porque V8 lo compacta; mirá el % del límite máximo o el RSS.',
  rss: 'Resident Set Size: memoria física total que ocupa el proceso Node.js en el sistema operativo.',
  memoriaExterna: 'Memoria usada por objetos C++ vinculados a V8 (buffers, etc.).',
  usoCpu: 'Porcentaje de CPU consumido por el proceso Node.js respecto a un núcleo, calculado entre lecturas.',
  socketsActivos: 'Conexiones WebSocket (Socket.IO) abiertas en este momento.',
  usuariosUnicos: 'Usuarios distintos con al menos un socket conectado.',
  cronWorker: 'Estado de los jobs cron programados en el proceso Node.js.',
  tareasProgramadas: 'Historial de ejecución de tareas cron en memoria. Ordená por última ejecución o resultado.',
  cronOrigen: 'Si la última ejecución fue disparada por el scheduler automático o manualmente.',
  cronResultado: 'Estado de la última ejecución: success, error o pendiente si nunca corrió.',
};
