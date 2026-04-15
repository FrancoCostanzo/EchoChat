const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const { pool } = require('./config/database');
const { ensureBuckets } = require('./config/minio');
const { initSocket } = require('./socket');

async function start() {
  try {
    // Verify database connection
    const client = await pool.connect();
    const { rows } = await client.query('SELECT NOW()');
    client.release();
    logger.info({ time: rows[0].now }, 'Database connected');

    // Ensure MinIO buckets exist
    try {
      await ensureBuckets();
    } catch (err) {
      logger.warn({ err: err.message }, 'MinIO not available — file storage will fail until connected');
    }

    // Create HTTP server and attach Socket.IO
    const server = http.createServer(app);
    initSocket(server);

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
    await pool.end();
    process.exit(0);
  });
}

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});

start();
