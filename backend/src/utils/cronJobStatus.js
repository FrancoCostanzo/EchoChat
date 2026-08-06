/** In-memory tracker of background cron job execution results. */

const config = require('../config');

const jobRuns = new Map();

function recordJobRun(name, { descripcion, resultado = 'success', origen = 'automatica' } = {}) {
  jobRuns.set(name, {
    descripcion: descripcion || name,
    ultimaEjecucion: new Date().toISOString(),
    resultado,
    origen,
    // Con varias instancias cada corrida la ejecuta una sola: saber cuál ayuda
    // a leer el panel, porque este Map sigue siendo local a cada proceso.
    instancia: config.instanceId,
  });
}

function getJobRuns() {
  return Object.fromEntries(jobRuns);
}

function getCronWorkerStatus() {
  const enabled = config.env === 'production';
  return {
    enabled,
    running: config.jobs.enabled,
    ready: true,
    instancia: config.instanceId,
    note: config.jobs.enabled
      ? 'Los jobs cron corren en el hilo principal del proceso Node.js. Con varias instancias, cada corrida la toma una sola (lock en Redis).'
      : 'RUN_JOBS=false: esta instancia no ejecuta jobs, sólo atiende tráfico.',
  };
}

module.exports = {
  recordJobRun,
  getJobRuns,
  getCronWorkerStatus,
};
