import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { callService } from '../services';
import { qInt, qStr, type AuthRequest } from '../types/http';

class CallController {
  async initiate(req: AuthRequest, res: Response) {
    const call = await callService.initiate(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: call });
  }

  async getById(req: AuthRequest, res: Response) {
    const call = await callService.getById(req.params.callId);
    res.json({ status: 'success', data: call });
  }

  async updateStatus(req: AuthRequest, res: Response) {
    const call = await callService.updateStatus(
      req.params.callId, req.user.id, req.body.status, req.body.end_reason
    );
    res.json({ status: 'success', data: call });
  }

  async updateParticipant(req: AuthRequest, res: Response) {
    const participant = await callService.updateParticipant(
      req.params.callId, req.params.userId, req.body
    );
    res.json({ status: 'success', data: participant });
  }

  async getByConversation(req: AuthRequest, res: Response) {
    const { limit, offset } = req.query;
    const calls = await callService.getByConversation(
      req.params.conversationId,
      { limit: qInt(limit, 20), offset: qInt(offset, 0) }
    );
    res.json({ status: 'success', data: calls });
  }

  async getActive(req: AuthRequest, res: Response) {
    const calls = await callService.getActiveByUser(req.user.id);
    res.json({ status: 'success', data: calls });
  }

  async getHistory(req: AuthRequest, res: Response) {
    const { limit, offset, filter } = req.query;
    const calls = await callService.getHistoryByUser(
      req.user.id,
      { limit: qInt(limit, 50), offset: qInt(offset, 0) },
      qStr(filter),
    );
    res.json({ status: 'success', data: calls });
  }
}

export = new CallController();
