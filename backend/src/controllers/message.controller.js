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

  async update(req, res) {
    const message = await messageService.update(req.params.messageId, req.user.id, req.body.body);
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
}

module.exports = new MessageController();
