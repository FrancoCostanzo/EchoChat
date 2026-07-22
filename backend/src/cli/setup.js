// CLI de instalación: aplica schema + migraciones y crea el primer admin.
// Uso:  npm run migrate   (o)   npm run setup
//
// Es lo mismo que hace el backend al arrancar, pero de forma independiente:
// útil para preparar una BD externa antes de levantar la app, o para forzar
// las migraciones sin reiniciar el servidor.

require('../config'); // carga variables de entorno (.env)
const logger = require('../config/logger');
const { pool } = require('../config/database');
const { setup } = require('../config/migrate');

setup()
  .then(() => {
    logger.info('Instalación/actualización completada');
    return pool.end();
  })
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error({ err }, 'Falló la instalación/actualización');
    try {
      await pool.end();
    } catch {
      /* noop */
    }
    process.exit(1);
  });
