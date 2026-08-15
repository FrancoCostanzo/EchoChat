import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { conversationService } from '../services';
import { qInt, type AuthRequest } from '../types/http';

class ConversationController {
  async create(req: AuthRequest, res: Response) {
    const conversation = await conversationService.create(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: conversation });
  }

  async getById(req: AuthRequest, res: Response) {
    const conversation = await conversationService.getById(req.params.conversationId, req.user.id);
    res.json({ status: 'success', data: conversation });
  }

  async getUserConversations(req: AuthRequest, res: Response) {
    const { limit, offset } = req.query;
    const conversations = await conversationService.getUserConversations(req.user.id, {
      limit: qInt(limit, 50),
      offset: qInt(offset, 0),
    });
    res.json({ status: 'success', data: conversations });
  }

  async update(req: AuthRequest, res: Response) {
    const conversation = await conversationService.update(req.params.conversationId, req.user.id, req.body);
    res.json({ status: 'success', data: conversation });
  }

  async addMembers(req: AuthRequest, res: Response) {
    const members = await conversationService.addMembers(
      req.params.conversationId, req.user.id, req.body.member_ids
    );
    res.status(StatusCodes.CREATED).json({ status: 'success', data: members });
  }

  async removeMember(req: AuthRequest, res: Response) {
    await conversationService.removeMember(
      req.params.conversationId, req.user.id, req.params.userId
    );
    res.json({ status: 'success', message: 'Member removed' });
  }

  async getMembers(req: AuthRequest, res: Response) {
    const { limit, offset } = req.query;
    const members = await conversationService.getMembers(
      req.params.conversationId, req.user.id,
      { limit: qInt(limit, 100), offset: qInt(offset, 0) }
    );
    res.json({ status: 'success', data: members });
  }

  async updateMember(req: AuthRequest, res: Response) {
    const member = await conversationService.updateMember(
      req.params.conversationId, req.user.id, req.params.userId, req.body
    );
    res.json({ status: 'success', data: member });
  }

  async markAsRead(req: AuthRequest, res: Response) {
    await conversationService.markAsRead(
      req.params.conversationId, req.user.id, req.body.message_id
    );
    res.json({ status: 'success', message: 'Marked as read' });
  }
}

export = new ConversationController();
