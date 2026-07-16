const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const { pool } = require('./config/database');
const { setup } = require('./config/migrate');
const { ensureBuckets } = require('./config/minio');
const { initSocket } = require('./socket');
const { startJobs, stopJobs } = require('./jobs');

async function start() {
  try {
    // Prepare the database: wait for it, apply schema + migrations and create
    // the first administrator. Controlled by RUN_MIGRATIONS_ON_BOOT (default on).
    // A failure here is fatal on purpose: better to crash (and let the
    // orchestrator restart) than to serve requests against a half-set-up DB.
    if (process.env.RUN_MIGRATIONS_ON_BOOT !== 'false') {
      await setup();
    } else {
      logger.info('RUN_MIGRATIONS_ON_BOOT=false — se omiten las migraciones al arranque');
    }

    // Ensure MinIO buckets exist
    try {
      await ensureBuckets();
    } catch (err) {
      logger.warn({ err }, 'MinIO not available — file storage will fail until connected');
    }

    // Create HTTP server and attach Socket.IO
    const server = http.createServer(app);
    initSocket(server);

    // Start background jobs (presence timeout, presigned URL cleanup, …)
    startJobs();

    // Start HTTP + WebSocket server
    server.listen(config.port, () => {
      logger.info({ port: config.port, env: config.env }, 'EchoChat backend started (HTTP + WebSocket)');
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    logger.info({ signal }, 'Shutting down gracefully...');
    stopJobs();
    await pool.end();
    process.exit(0);
  });
}

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});

start();
