const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const monitoringController = require('../controllers/monitoring.controller');
const { authenticate, loadRbac } = require('../middlewares');
const { ForbiddenError } = require('../errors');

const healthRouter = Router();
const monitoringRouter = Router();

function requireAdminAccess(req, res, next) {
  loadRbac(req)
    .then(() => {
      if (req.roles.includes('super_admin')) return next();
      if (req.permissions.some((p) => p.startsWith('admin.'))) return next();
      throw new ForbiddenError('Admin access required for monitoring');
    })
    .catch(next);
}

const monitoringLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Demasiadas solicitudes de monitoreo. Intente nuevamente en un minuto.',
  },
});

const adminGuard = [authenticate, requireAdminAccess];

// Probes públicos (sin JWT)
healthRouter.get('/live', (req, res) => monitoringController.getLiveness(req, res));
healthRouter.get('/ready', (req, res) => monitoringController.getReadiness(req, res));

// Endpoints de monitoreo (requieren admin + rate limit)
monitoringRouter.use(monitoringLimiter);

monitoringRouter.get('/dashboard', ...adminGuard, (req, res) => monitoringController.getDashboard(req, res));
monitoringRouter.get('/health', ...adminGuard, (req, res) => monitoringController.getCompleteSystemStatus(req, res));
monitoringRouter.get('/database', ...adminGuard, (req, res) => monitoringController.getDetailedPoolStats(req, res));
monitoringRouter.get('/system', ...adminGuard, (req, res) => monitoringController.getSystemMetrics(req, res));
monitoringRouter.get('/history', ...adminGuard, (req, res) => monitoringController.getSnapshotHistory(req, res));

module.exports = { healthRouter, monitoringRouter };
