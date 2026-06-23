/** In-memory tracker of background cron job execution results. */

const jobRuns = new Map();

function recordJobRun(name, { descripcion, resultado = 'success', origen = 'automatica' } = {}) {
  jobRuns.set(name, {
    descripcion: descripcion || name,
    ultimaEjecucion: new Date().toISOString(),
    resultado,
    origen,
  });
}

function getJobRuns() {
  return Object.fromEntries(jobRuns);
}

function getCronWorkerStatus() {
  const config = require('../config');
  const enabled = config.env === 'production';
  return {
    enabled,
    running: true,
    ready: true,
    note: enabled
      ? 'Los jobs cron corren en el hilo principal del proceso Node.js.'
      : 'Jobs cron activos en todos los entornos; el flag "enabled" indica producción.',
  };
}

module.exports = {
  recordJobRun,
  getJobRuns,
  getCronWorkerStatus,
};
