const { RedisStore } = require('rate-limit-redis');
const { isRedisEnabled, getRedisClient } = require('./redis');

/**
 * Store compartido para express-rate-limit. Con el MemoryStore por defecto cada
 * instancia lleva su propia cuenta, así que con N instancias el límite efectivo
 * es N veces el configurado. Devuelve `undefined` si no hay Redis, con lo que
 * express-rate-limit vuelve al MemoryStore (correcto con una sola instancia).
 *
 * `prefix` separa los contadores de cada limitador dentro del mismo Redis.
 */
function createRateLimitStore(prefix) {
  if (!isRedisEnabled()) return undefined;

  return new RedisStore({
    prefix,
    // El store se construye al cargar el módulo, antes de que Redis esté
    // conectado: resolvemos el cliente en cada comando (ya viene cacheado).
    sendCommand: async (...args) => {
      const client = await getRedisClient();
      return client.sendCommand(args);
    },
  });
}

module.exports = { createRateLimitStore };
