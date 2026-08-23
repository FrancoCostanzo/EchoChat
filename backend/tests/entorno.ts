/**
 * Preload de la suite: fija el entorno antes de que se cargue nada de la app.
 *
 * Va como `--require` en el script de test y no como import de los helpers
 * porque `src/config` lee `process.env` al cargarse: si el entorno se fijara
 * dentro de un módulo, el orden de evaluación no estaría garantizado. Node
 * propaga el preload a los procesos hijos que abre el runner por cada archivo.
 *
 * dotenvx no pisa variables ya definidas, así que esto le gana al `.env`.
 */

/** Base de datos de la suite. Nunca la de desarrollo: ver la guarda de servidor.ts. */
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || 'echochat_test';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME;

// Las baterías hacen cientos de requests; con el límite por defecto (100 cada
// 15 minutos) la suite se estrangularía sola y fallaría por motivos ajenos.
process.env.RATE_LIMIT_MAX = '100000';

// Sin adapter: cada archivo de test levanta su instancia en su propio proceso y
// no queremos que se crucen por un Redis compartido.
process.env.REDIS_URL = '';

// Los jobs cron no aportan nada acá y ensucian la salida.
process.env.RUN_JOBS = 'false';

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'Admin1234!';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL || 'silent';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-tests';
// Clave fija de 32 bytes en base64, que es lo que exige el cifrado en reposo.
// Fija a propósito: los tests tienen que ser reproducibles, y no cifra nada real.
process.env.MESSAGE_ENC_KEY = process.env.MESSAGE_ENC_KEY
  || '1qRzXT/frO9XABpxCbCeSZkV8BbKTJyd/O/QgM/4YUk=';

// SCIM se prueba entero, así que va habilitado con un token fijo.
process.env.SCIM_ENABLED = 'true';
process.env.SCIM_TOKEN = 'token-scim-de-la-suite-de-tests';
