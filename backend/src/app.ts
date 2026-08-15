import 'express-async-errors';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';

import config from './config';
import logger from './config/logger';
import { pool } from './config/database';
import { createRateLimitStore } from './config/rateLimitStore';
import { isRedisEnabled, getRedisClient } from './config/redis';
import routes from './routes';
import { errorHandler } from './middlewares';
import httpMetrics from './middlewares/httpMetrics';
import scimRoutes from './routes/scim.routes';

const app = express();

// ── Security ────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// ── Rate limiting ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  store: createRateLimitStore('rl:global:'),
  standardHeaders: true,
  legacyHeaders: false,
  // SCIM tiene su propio límite (holgado) en su router: los IdPs hacen ráfagas.
  skip: (req) => req.path.startsWith('/scim'),
  message: { status: 'error', message: 'Too many requests, please try again later' },
}));

// ── Body parsing ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── SCIM 2.0 ──────────────────────────────────────────────────────────────
// Fuera de /api: tiene su propia auth (bearer), content-type (application/scim+json)
// y formato de error. Los clientes SCIM mandan application/scim+json, que el parser
// global de JSON no reconoce, así que le damos su propio express.json.
app.use('/scim/v2',
  express.json({ type: ['application/json', 'application/scim+json'], limit: '1mb' }),
  scimRoutes);

// ── Request logging ─────────────────────────────────────────────────────
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health',
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
}));

// ── Health check ────────────────────────────────────────────────────────
app.get('/api/health', async (req: Request, res: Response) => {
  let db = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    db = 'unavailable';
  }

  const redis = await checkRedis();

  // Sólo la BD decide el código de estado. Si un parpadeo de Redis marcara
  // "unhealthy", TODAS las instancias caerían a la vez y el orquestador las
  // reiniciaría en cascada; el estado de Redis se informa en el cuerpo.
  const status = db === 'ok' ? 'ok' : 'degraded';
  res.status(db === 'ok' ? 200 : 503).json({
    status,
    db,
    redis,
    timestamp: new Date().toISOString(),
  });
});

// 'disabled' = una sola instancia (sin REDIS_URL), que es una configuración
// válida y no un problema.
async function checkRedis(): Promise<string> {
  if (!isRedisEnabled()) return 'disabled';
  try {
    const client = await getRedisClient();
    await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
    ]);
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

// ── HTTP metrics (in-memory) ────────────────────────────────────────────
app.use(httpMetrics);

// ── API routes ──────────────────────────────────────────────────────────
app.use('/api', routes);

// ── Error handling ──────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
