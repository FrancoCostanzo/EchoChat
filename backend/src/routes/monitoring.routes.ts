import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import monitoringController from '../controllers/monitoring.controller';
import { authenticate, loadRbac } from '../middlewares';
import { ForbiddenError } from '../errors';

const healthRouter = Router();
const monitoringRouter = Router();

function requireAdminAccess(req: Request, res: Response, next: NextFunction) {
  loadRbac(req)
    .then((rbac) => {
      if (rbac.roles.includes('super_admin')) return next();
      if (rbac.permissions.some((p) => p.startsWith('admin.'))) return next();
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

export { healthRouter, monitoringRouter };
