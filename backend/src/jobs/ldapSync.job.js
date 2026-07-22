const config = require('../config');
const logger = require('../config/logger');
const { adminService, ldapService } = require('../services');

// Sincroniza usuarios/departamentos desde el directorio LDAP en segundo plano.
// No-op salvo que LDAP esté habilitado y el sync automático activado, así el job
// puede quedar registrado siempre con un schedule válido sin efectos secundarios.
async function run() {
  if (!config.ldap.syncEnabled || !ldapService.isEnabled()) return;
  const summary = await adminService.syncLdapUsers({ origin: 'automatic' });
  logger.info(summary, 'LDAP scheduled sync finished');
}

module.exports = {
  name: 'ldap-sync',
  descripcion: 'Sincronización automática de usuarios LDAP/AD',
  schedule: config.ldap.syncCron,
  run,
};
