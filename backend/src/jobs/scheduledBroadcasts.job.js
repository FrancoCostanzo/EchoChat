const logger = require('../config/logger');
const { broadcastService } = require('../services');

// Dispatches broadcast messages whose scheduled_at has passed.
async function run() {
  const count = await broadcastService.processDueScheduled();
  if (count > 0) {
    logger.info({ count }, 'Scheduled broadcasts dispatched');
  }
}

module.exports = {
  name: 'scheduled-broadcasts',
  schedule: '* * * * *',
  run,
};
