import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { messageService } from '../services';
import { qInt, qStr, type AuthRequest } from '../types/http';

class MessageController {
  async send(req: AuthRequest, res: Response) {
    const message = await messageService.send(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }

  async getMessages(req: AuthRequest, res: Response) {
    const { cursor, limit, direction } = req.query;
    const messages = await messageService.getMessages(
      req.params.conversationId, req.user.id,
      {
        cursor: qStr(cursor),
        limit: qInt(limit, 50),
        direction: qStr(direction) === 'after' ? 'after' : 'before',
      }
    );
    res.json({ status: 'success', data: messages });
  }

  async getById(req: AuthRequest, res: Response) {
    const message = await messageService.getById(req.params.messageId);
    res.json({ status: 'success', data: message });
  }

  async getThread(req: AuthRequest, res: Response) {
    const thread = await messageService.getThread(req.params.messageId, req.user.id);
    res.json({ status: 'success', data: thread });
  }

  async update(req: AuthRequest, res: Response) {
    const message = await messageService.update(
      req.params.messageId,
      req.user.id,
      req.body.body,
      req.body.body_format,
    );
    res.json({ status: 'success', data: message });
  }

  async delete(req: AuthRequest, res: Response) {
    const message = await messageService.delete(req.params.messageId, req.user.id);
    res.json({ status: 'success', data: message });
  }

  async addReaction(req: AuthRequest, res: Response) {
    const reactions = await messageService.addReaction(req.params.messageId, req.user.id, req.body.emoji);
    res.json({ status: 'success', data: reactions });
  }

  async removeReaction(req: AuthRequest, res: Response) {
    const reactions = await messageService.removeReaction(req.params.messageId, req.user.id, req.params.emoji);
    res.json({ status: 'success', data: reactions });
  }

  async addReceipt(req: AuthRequest, res: Response) {
    const receipt = await messageService.addReceipt(req.params.messageId, req.user.id, req.body.type);
    res.json({ status: 'success', data: receipt });
  }

  async search(req: AuthRequest, res: Response) {
    const { q, limit } = req.query;
    const messages = await messageService.search(
      req.params.conversationId, req.user.id, String(q ?? ''), qInt(limit, 20)
    );
    res.json({ status: 'success', data: messages });
  }

  async getInfo(req: AuthRequest, res: Response) {
    const info = await messageService.getMessageInfo(req.params.messageId, req.user.id);
    res.json({ status: 'success', data: info });
  }

  async pin(req: AuthRequest, res: Response) {
    await messageService.pinMessage(req.params.conversationId, req.params.messageId, req.user.id);
    res.json({ status: 'success', message: 'Message pinned' });
  }

  async unpin(req: AuthRequest, res: Response) {
    await messageService.unpinMessage(req.params.conversationId, req.params.messageId);
    res.json({ status: 'success', message: 'Message unpinned' });
  }

  async getPinned(req: AuthRequest, res: Response) {
    const messages = await messageService.getPinnedMessages(req.params.conversationId, req.user.id);
    res.json({ status: 'success', data: messages });
  }

  // ── Saved messages ────────────────────────────────────────────────────────
  async listSaved(req: AuthRequest, res: Response) {
    const { limit, offset } = req.query;
    const messages = await messageService.listSaved(req.user.id, {
      limit: qInt(limit, 50),
      offset: qInt(offset, 0),
    });
    res.json({ status: 'success', data: messages });
  }

  async save(req: AuthRequest, res: Response) {
    const saved = await messageService.saveMessage(req.user.id, req.params.messageId, req.body?.note);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: saved });
  }

  async unsave(req: AuthRequest, res: Response) {
    await messageService.unsaveMessage(req.user.id, req.params.messageId);
    res.json({ status: 'success', message: 'Message unsaved' });
  }

  async forward(req: AuthRequest, res: Response) {
    const messages = await messageService.forward(
      req.user.id, req.params.messageId, req.body.conversation_ids
    );
    res.status(StatusCodes.CREATED).json({ status: 'success', data: messages });
  }

  // ── Drafts ──────────────────────────────────────────────────────────────
  async listDrafts(req: AuthRequest, res: Response) {
    const drafts = await messageService.listDrafts(req.user.id);
    res.json({ status: 'success', data: drafts });
  }

  async getDraft(req: AuthRequest, res: Response) {
    const draft = await messageService.getDraft(req.user.id, req.params.conversationId);
    res.json({ status: 'success', data: draft });
  }

  async saveDraft(req: AuthRequest, res: Response) {
    const draft = await messageService.saveDraft(req.user.id, req.params.conversationId, req.body);
    res.json({ status: 'success', data: draft });
  }

  async deleteDraft(req: AuthRequest, res: Response) {
    await messageService.deleteDraft(req.user.id, req.params.conversationId);
    res.json({ status: 'success', message: 'Draft deleted' });
  }
}

export default new MessageController();
