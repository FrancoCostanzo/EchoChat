import config from '../config';
import logger from '../config/logger';
import { adminService, ldapService } from '../services';
import type { BackgroundJob } from './index';

// Sincroniza usuarios/departamentos desde el directorio LDAP en segundo plano.
// No-op salvo que LDAP esté habilitado y el sync automático activado, así el job
// puede quedar registrado siempre con un schedule válido sin efectos secundarios.
async function run(): Promise<void> {
  if (!config.ldap.syncEnabled || !ldapService.isEnabled()) return;
  const summary = await adminService.syncLdapUsers({ origin: 'automatic' });
  logger.info(summary, 'LDAP scheduled sync finished');
}

const job: BackgroundJob = {
  name: 'ldap-sync',
  descripcion: 'Sincronización automática de usuarios LDAP/AD',
  schedule: config.ldap.syncCron,
  run,
};

export = job;
