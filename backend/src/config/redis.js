const { createClient } = require('redis');
const config = require('../config');
const logger = require('./logger');

// Redis es el estado compartido entre instancias del backend: sin él, Socket.IO
// sólo alcanza a los sockets del propio proceso y la app queda limitada a UNA
// instancia (ver docs/SCALING.md). Es opcional a propósito: si REDIS_URL no está
// definido, el backend arranca como siempre y no se monta el adapter.

const clients = [];

// Intentos antes de rendirse en la conexión inicial (~3 s en total).
const MAX_INITIAL_RETRIES = 5;

function isRedisEnabled() {
  return Boolean(config.redis.url);
}

/**
 * Crea y conecta un cliente Redis. `role` sólo se usa para los logs (pub/sub/…).
 * Si Redis está configurado pero no responde al arrancar, la promesa rechaza:
 * preferimos caer (y que el orquestador reinicie) antes que servir tráfico con
 * instancias incomunicadas entre sí.
 */
async function createRedisClient(role) {
  if (!isRedisEnabled()) {
    throw new Error('REDIS_URL no está configurado');
  }

  let connected = false;

  const client = createClient({
    url: config.redis.url,
    socket: {
      connectTimeout: 10_000,
      reconnectStrategy: (retries) => {
        // Sin este corte, connect() reintentaría para siempre y el backend se
        // quedaría colgado antes de escuchar: un proceso que nunca arranca es
        // peor que uno que se reinicia. Ya conectado, reintenta indefinidamente
        // para sobrevivir a una caída pasajera de Redis.
        if (!connected && retries >= MAX_INITIAL_RETRIES) {
          return new Error(`No se pudo conectar a Redis tras ${MAX_INITIAL_RETRIES} intentos`);
        }
        return Math.min((retries + 1) * 200, 5000);
      },
    },
  });

  client.on('error', (err) => {
    logger.warn({ err: err.message, role }, 'Redis error');
  });
  client.on('ready', () => {
    connected = true;
    logger.info({ role }, 'Redis conectado');
  });

  await client.connect();
  clients.push(client);
  return client;
}

let commandClient = null;

/**
 * Cliente compartido para comandos normales. Los clientes de pub/sub quedan en
 * modo suscriptor y no pueden ejecutar otros comandos, así que hace falta uno
 * aparte. Se conecta perezosamente y se reutiliza; devuelve `null` si Redis no
 * está configurado, para que quien lo use pueda degradar a memoria local.
 */
function getRedisClient() {
  if (!isRedisEnabled()) return Promise.resolve(null);
  if (!commandClient) {
    commandClient = createRedisClient('commands').catch((err) => {
      commandClient = null; // permite reintentar en la próxima llamada
      throw err;
    });
  }
  return commandClient;
}

/** Cierra todos los clientes creados. Se llama en el apagado ordenado. */
async function closeRedis() {
  commandClient = null;
  await Promise.allSettled(clients.map((client) => client.quit()));
  clients.length = 0;
}

module.exports = { isRedisEnabled, createRedisClient, getRedisClient, closeRedis };
