import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { scheduledService } from '../services';
import type { AuthRequest } from '../types/http';

class ScheduledController {
  async schedule(req: AuthRequest, res: Response) {
    const programado = await scheduledService.programar(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: programado });
  }

  async listScheduled(req: AuthRequest, res: Response) {
    const programados = await scheduledService.listarProgramados(req.user.id);
    res.json({ status: 'success', data: programados });
  }

  async cancelScheduled(req: AuthRequest, res: Response) {
    const programado = await scheduledService.cancelarProgramado(req.params.id, req.user.id);
    res.json({ status: 'success', data: programado });
  }

  async createReminder(req: AuthRequest, res: Response) {
    const recordatorio = await scheduledService.recordar(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: recordatorio });
  }

  async listReminders(req: AuthRequest, res: Response) {
    const recordatorios = await scheduledService.listarRecordatorios(req.user.id);
    res.json({ status: 'success', data: recordatorios });
  }

  async cancelReminder(req: AuthRequest, res: Response) {
    const recordatorio = await scheduledService.cancelarRecordatorio(req.params.id, req.user.id);
    res.json({ status: 'success', data: recordatorio });
  }
}

export default new ScheduledController();
