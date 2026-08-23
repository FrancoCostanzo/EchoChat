import logger from '../config/logger';
import monitoringService from '../services/monitoring.service';
import type { BackgroundJob } from './index';

async function run(): Promise<void> {
  const result = await monitoringService.collectSnapshot();
  logger.debug(
    { snapshotId: result.insertResult?.id, purged: result.purgeResult?.deleted },
    'Monitoring snapshot collected',
  );
}

const job: BackgroundJob = {
  name: 'monitoring-snapshot',
  schedule: '*/5 * * * *',
  descripcion: 'Recolección de métricas del sistema cada 5 minutos',
  run,
};

export default job;
