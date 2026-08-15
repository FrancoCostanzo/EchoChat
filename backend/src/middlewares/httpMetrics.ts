import type { Request, Response, NextFunction } from 'express';
import * as metricsRegistry from '../utils/metricsRegistry';

function httpMetrics(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    metricsRegistry.recordRequest({
      method: req.method,
      path: req.route?.path
        ? `${req.baseUrl || ''}${req.route.path}`
        : req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}

export default httpMetrics;
