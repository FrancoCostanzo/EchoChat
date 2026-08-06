/**
 * Tracks users whose 'away' presence was set automatically by the presence
 * timeout job (as opposed to a manual choice in Settings). Activity heartbeats
 * only restore 'online' for marked users, so a manual "away" stays put.
 *
 * Vive en Redis porque el job puede correr en una instancia y el heartbeat del
 * usuario llegar a otra: con la marca en memoria, ese usuario se quedaba 'away'
 * para siempre. Sin REDIS_URL cae a un Set por proceso (comportamiento de
 * siempre, correcto mientras haya una sola instancia).
 */

const { isRedisEnabled, getRedisClient } = require('./redis');
const logger = require('./logger');

// Si el usuario nunca vuelve, la marca se limpia sola y no crece sin límite.
const TTL_SECONDS = 24 * 60 * 60;

const key = (userId) => `presence:auto-away:${userId}`;

// Respaldo por instancia: sin Redis, o si Redis falla puntualmente.
const localAutoAway = new Set();

async function client() {
  if (!isRedisEnabled()) return null;
  try {
    return await getRedisClient();
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis no disponible para presencia — se usa memoria local');
    return null;
  }
}

/** El job de timeout marca al usuario como auto-away. */
async function markAutoAway(userId) {
  const redis = await client();
  if (!redis) {
    localAutoAway.add(userId);
    return;
  }
  try {
    await redis.setEx(key(userId), TTL_SECONDS, '1');
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'Failed to mark auto-away in Redis');
    localAutoAway.add(userId);
  }
}

/** ¿El 'away' de este usuario lo puso el job (y no el propio usuario)? */
async function isAutoAway(userId) {
  const redis = await client();
  if (!redis) return localAutoAway.has(userId);
  try {
    return (await redis.exists(key(userId))) === 1;
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'Failed to read auto-away from Redis');
    return localAutoAway.has(userId);
  }
}

/** Cualquier cambio explícito de presencia borra la marca. */
async function clearAutoAway(userId) {
  localAutoAway.delete(userId);
  const redis = await client();
  if (!redis) return;
  try {
    await redis.del(key(userId));
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'Failed to clear auto-away in Redis');
  }
}

module.exports = { markAutoAway, isAutoAway, clearAutoAway };
