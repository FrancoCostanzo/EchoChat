require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./config/logger');
const { pool } = require('./config/database');
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
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
}));

// ── Body parsing ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
  const status = db === 'ok' ? 'ok' : 'degraded';
  res.status(db === 'ok' ? 200 : 503).json({ status, db, timestamp: new Date().toISOString() });
});

// ── HTTP metrics (in-memory) ────────────────────────────────────────────
app.use(httpMetrics);

// ── API routes ──────────────────────────────────────────────────────────
app.use('/api', routes);

// ── Error handling ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
