import http from 'http';
import app from './app';
import config from './config';
import logger from './config/logger';
import { pool } from './config/database';
import { setup } from './config/migrate';
import { ensureBuckets } from './config/minio';
import { closeRedis } from './config/redis';
import { initSocket, closeSocket } from './socket';
import { startJobs, stopJobs } from './jobs';

// Tope para el apagado: si algo no cierra, salimos igual en vez de quedar
// colgados y que el orquestador tenga que matar el contenedor a la fuerza.
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start(): Promise<void> {
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
    await initSocket(server);

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

// Graceful shutdown. El orden importa: primero dejamos de aceptar trabajo y
// desconectamos a los clientes (que se reconectan contra otra instancia), y
// recién después soltamos Redis —que usa el adapter— y el pool de Postgres.
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down gracefully...');

  const timer = setTimeout(() => {
    logger.warn({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Apagado forzado: algo no cerró a tiempo');
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  try {
    stopJobs();
    await closeSocket();
    await closeRedis();
    await pool.end();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Error durante el apagado');
  }
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown(signal));
}

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});

start();
