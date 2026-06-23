const { StatusCodes } = require('http-status-codes');
const { messageService } = require('../services');

class MessageController {
  async send(req, res) {
    const message = await messageService.send(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }

  async getMessages(req, res) {
    const { cursor, limit = 50, direction = 'before' } = req.query;
    const messages = await messageService.getMessages(
      req.params.conversationId, req.user.id,
      { cursor, limit: parseInt(limit, 10), direction }
    );
    res.json({ status: 'success', data: messages });
  }

  async getById(req, res) {
    const message = await messageService.getById(req.params.messageId);
    res.json({ status: 'success', data: message });
  }

  async getThread(req, res) {
    const thread = await messageService.getThread(req.params.messageId, req.user.id);
    res.json({ status: 'success', data: thread });
  }

  async update(req, res) {
    const message = await messageService.update(
      req.params.messageId,
      req.user.id,
      req.body.body,
      req.body.body_format,
    );
    res.json({ status: 'success', data: message });
  }

  async delete(req, res) {
    await messageService.delete(req.params.messageId, req.user.id);
    res.json({ status: 'success', message: 'Message deleted' });
  }

  async addReaction(req, res) {
    const reactions = await messageService.addReaction(req.params.messageId, req.user.id, req.body.emoji);
    res.json({ status: 'success', data: reactions });
  }

  async removeReaction(req, res) {
    const reactions = await messageService.removeReaction(req.params.messageId, req.user.id, req.params.emoji);
    res.json({ status: 'success', data: reactions });
  }

  async addReceipt(req, res) {
    const receipt = await messageService.addReceipt(req.params.messageId, req.user.id, req.body.type);
    res.json({ status: 'success', data: receipt });
  }

  async search(req, res) {
    const { q, limit = 20 } = req.query;
    const messages = await messageService.search(
      req.params.conversationId, req.user.id, q, parseInt(limit, 10)
    );
    res.json({ status: 'success', data: messages });
  }

  async getInfo(req, res) {
    const info = await messageService.getMessageInfo(req.params.messageId, req.user.id);
    res.json({ status: 'success', data: info });
  }

  async pin(req, res) {
    await messageService.pinMessage(req.params.conversationId, req.params.messageId, req.user.id);
    res.json({ status: 'success', message: 'Message pinned' });
  }

  async unpin(req, res) {
    await messageService.unpinMessage(req.params.conversationId, req.params.messageId);
    res.json({ status: 'success', message: 'Message unpinned' });
  }

  async getPinned(req, res) {
    const messages = await messageService.getPinnedMessages(req.params.conversationId, req.user.id);
    res.json({ status: 'success', data: messages });
  }

  // ── Saved messages ────────────────────────────────────────────────────────
  async listSaved(req, res) {
    const { limit = 50, offset = 0 } = req.query;
    const messages = await messageService.listSaved(req.user.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json({ status: 'success', data: messages });
  }

  async save(req, res) {
    const saved = await messageService.saveMessage(req.user.id, req.params.messageId, req.body?.note);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: saved });
  }

  async unsave(req, res) {
    await messageService.unsaveMessage(req.user.id, req.params.messageId);
    res.json({ status: 'success', message: 'Message unsaved' });
  }

  async forward(req, res) {
    const messages = await messageService.forward(
      req.user.id, req.params.messageId, req.body.conversation_ids
    );
    res.status(StatusCodes.CREATED).json({ status: 'success', data: messages });
  }

  // ── Drafts ──────────────────────────────────────────────────────────────
  async listDrafts(req, res) {
    const drafts = await messageService.listDrafts(req.user.id);
    res.json({ status: 'success', data: drafts });
  }

  async getDraft(req, res) {
    const draft = await messageService.getDraft(req.user.id, req.params.conversationId);
    res.json({ status: 'success', data: draft });
  }

  async saveDraft(req, res) {
    const draft = await messageService.saveDraft(req.user.id, req.params.conversationId, req.body);
    res.json({ status: 'success', data: draft });
  }

  async deleteDraft(req, res) {
    await messageService.deleteDraft(req.user.id, req.params.conversationId);
    res.json({ status: 'success', message: 'Draft deleted' });
  }
}

module.exports = new MessageController();
