const logger = require('../config/logger');
const monitoringService = require('../services/monitoring.service');

async function run() {
  const result = await monitoringService.collectSnapshot();
  logger.debug(
    { snapshotId: result.insertResult?.id, purged: result.purgeResult?.deleted },
    'Monitoring snapshot collected',
  );
}

module.exports = {
  name: 'monitoring-snapshot',
  schedule: '*/5 * * * *',
  descripcion: 'Recolección de métricas del sistema cada 5 minutos',
  run,
};
