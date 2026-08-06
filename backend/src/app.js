require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./config/logger');
const { pool } = require('./config/database');
const { createRateLimitStore } = require('./config/rateLimitStore');
const { isRedisEnabled, getRedisClient } = require('./config/redis');
const routes = require('./routes');
const { errorHandler } = require('./middlewares');
const httpMetrics = require('./middlewares/httpMetrics');

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
  require('./routes/scim.routes'));

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
app.get('/api/health', async (req, res) => {
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
async function checkRedis() {
  if (!isRedisEnabled()) return 'disabled';
  try {
    const client = await getRedisClient();
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
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

module.exports = app;
