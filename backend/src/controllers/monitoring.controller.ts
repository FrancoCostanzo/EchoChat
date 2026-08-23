import type { Request, Response } from 'express';
import monitoringService from '../services/monitoring.service';
import { qStr } from '../types/http';

class MonitoringController {
  async getDashboard(req: Request, res: Response) {
    const data = await monitoringService.getDashboard();
    res.json({ status: 'success', data });
  }

  async getCompleteSystemStatus(req: Request, res: Response) {
    const data = await monitoringService.getCompleteSystemStatus();
    res.json({ status: 'success', data });
  }

  async getSystemMetrics(req: Request, res: Response) {
    const data = await monitoringService.getSystemMetrics();
    res.json({ status: 'success', data });
  }

  async getDetailedPoolStats(req: Request, res: Response) {
    const data = await monitoringService.getDetailedPoolStats();
    res.json({ status: 'success', data });
  }

  async getSnapshotHistory(req: Request, res: Response) {
    const range = qStr(req.query.range) || '24h';
    const data = await monitoringService.getSnapshotHistory(range);
    res.json({ status: 'success', data });
  }

  async getLiveness(req: Request, res: Response) {
    const data = monitoringService.getLiveness();
    res.json({ status: 'success', data });
  }

  async getReadiness(req: Request, res: Response) {
    const data = await monitoringService.getReadiness();
    const statusCode = data.ready ? 200 : 503;
    res.status(statusCode).json({ status: 'success', data });
  }
}

export default new MonitoringController();
