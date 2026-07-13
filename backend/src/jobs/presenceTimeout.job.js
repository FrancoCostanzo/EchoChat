const logger = require('../config/logger');
const { pool } = require('../config/database');
const { autoAwayUsers } = require('../config/presenceStore');
const { userRepository } = require('../repositories');

const DEFAULT_TIMEOUT_MINUTES = 5;

// Read presence_timeout_minutes from system_settings, falling back to a default.
async function getTimeoutMinutes() {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'presence_timeout_minutes'`
    );
    const raw = rows[0]?.value;
    const minutes = parseInt(raw, 10);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_TIMEOUT_MINUTES;
  } catch {
    return DEFAULT_TIMEOUT_MINUTES;
  }
}

// Marks inactive 'online' users as 'away' and broadcasts the change over Socket.IO.
async function run() {
  const minutes = await getTimeoutMinutes();
  const affectedIds = await userRepository.markStaleOnlineAsAway(minutes);
  if (affectedIds.length === 0) return;

  // Remember these were auto-away so an activity heartbeat can restore them.
  for (const userId of affectedIds) autoAwayUsers.add(userId);

  logger.debug({ count: affectedIds.length }, 'Presence timeout: users set to away');
  try {
    const { getIO } = require('../socket');
    const io = getIO();
    for (const userId of affectedIds) {
      io.emit('presence:changed', { userId, presence: 'away' });
    }
  } catch {
    // Socket not initialised (e.g. running outside the server) — skip broadcast.
  }
}

module.exports = {
  name: 'presence-timeout',
  schedule: '* * * * *', // every minute
  run,
};
