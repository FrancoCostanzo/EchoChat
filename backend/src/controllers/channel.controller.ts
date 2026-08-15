import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { channelService } from '../services';
import { qInt, qStr, type AuthRequest } from '../types/http';

class ChannelController {
  async create(req: AuthRequest, res: Response) {
    const channel = await channelService.createChannel(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: channel });
  }

  async discover(req: AuthRequest, res: Response) {
    const { search, category, limit, offset } = req.query;
    const channels = await channelService.listDiscoverable(req.user.id, {
      search: qStr(search),
      category: qStr(category),
      limit: qInt(limit, 30),
      offset: qInt(offset, 0),
    });
    res.json({ status: 'success', data: channels });
  }

  async getById(req: AuthRequest, res: Response) {
    const channel = await channelService.getChannel(req.params.conversationId, req.user.id);
    res.json({ status: 'success', data: channel });
  }

  async updateSettings(req: AuthRequest, res: Response) {
    const channel = await channelService.updateSettings(req.params.conversationId, req.user.id, req.body);
    res.json({ status: 'success', data: channel });
  }

  async join(req: AuthRequest, res: Response) {
    const result = await channelService.join(req.params.conversationId, req.user.id, req.body?.message);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: result });
  }

  async listRequests(req: AuthRequest, res: Response) {
    const { status, limit, offset } = req.query;
    const requests = await channelService.listJoinRequests(req.params.conversationId, req.user.id, {
      status: qStr(status) ?? 'pending',
      limit: qInt(limit, 50),
      offset: qInt(offset, 0),
    });
    res.json({ status: 'success', data: requests });
  }

  async reviewRequest(req: AuthRequest, res: Response) {
    const request = await channelService.reviewJoinRequest(
      req.params.conversationId, req.params.requestId, req.user.id, req.body.status
    );
    res.json({ status: 'success', data: request });
  }
}

export = new ChannelController();
