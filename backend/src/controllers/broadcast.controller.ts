import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { broadcastService } from '../services';
import type { AuthRequest } from '../types/http';

class BroadcastController {
  async createList(req: AuthRequest, res: Response) {
    const list = await broadcastService.createList(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: list });
  }

  async getLists(req: AuthRequest, res: Response) {
    const lists = await broadcastService.getLists(req.user.id);
    res.json({ status: 'success', data: lists });
  }

  async getListById(req: AuthRequest, res: Response) {
    const list = await broadcastService.getListById(req.params.listId, req.user.id);
    res.json({ status: 'success', data: list });
  }

  async getMessages(req: AuthRequest, res: Response) {
    const messages = await broadcastService.getMessages(req.params.listId, req.user.id);
    res.json({ status: 'success', data: messages });
  }

  async getDeliveries(req: AuthRequest, res: Response) {
    const deliveries = await broadcastService.getDeliveries(
      req.params.listId,
      req.params.messageId,
      req.user.id,
    );
    res.json({ status: 'success', data: deliveries });
  }

  async sendMessage(req: AuthRequest, res: Response) {
    const message = await broadcastService.sendMessage(req.params.listId, req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }

  async addRecipients(req: AuthRequest, res: Response) {
    const recipients = await broadcastService.addRecipients(
      req.params.listId,
      req.user.id,
      req.body,
    );
    res.status(StatusCodes.CREATED).json({ status: 'success', data: recipients });
  }

  async removeRecipient(req: AuthRequest, res: Response) {
    const recipients = await broadcastService.removeRecipient(
      req.params.listId,
      req.user.id,
      req.params.userId,
    );
    res.json({ status: 'success', data: recipients });
  }
}

export = new BroadcastController();
