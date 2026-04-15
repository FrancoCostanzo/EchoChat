const { StatusCodes } = require('http-status-codes');
const { conversationService } = require('../services');

class ConversationController {
  async create(req, res) {
    const conversation = await conversationService.create(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: conversation });
  }

  async getById(req, res) {
    const conversation = await conversationService.getById(req.params.conversationId, req.user.id);
    res.json({ status: 'success', data: conversation });
  }

  async getUserConversations(req, res) {
    const { limit = 50, offset = 0 } = req.query;
    const conversations = await conversationService.getUserConversations(req.user.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json({ status: 'success', data: conversations });
  }

  async update(req, res) {
    const conversation = await conversationService.update(req.params.conversationId, req.user.id, req.body);
    res.json({ status: 'success', data: conversation });
  }

  async addMembers(req, res) {
    const members = await conversationService.addMembers(
      req.params.conversationId, req.user.id, req.body.member_ids
    );
    res.status(StatusCodes.CREATED).json({ status: 'success', data: members });
  }

  async removeMember(req, res) {
    await conversationService.removeMember(
      req.params.conversationId, req.user.id, req.params.userId
    );
    res.json({ status: 'success', message: 'Member removed' });
  }

  async getMembers(req, res) {
    const { limit = 100, offset = 0 } = req.query;
    const members = await conversationService.getMembers(
      req.params.conversationId, req.user.id,
      { limit: parseInt(limit, 10), offset: parseInt(offset, 10) }
    );
    res.json({ status: 'success', data: members });
  }

  async updateMember(req, res) {
    const member = await conversationService.updateMember(
      req.params.conversationId, req.user.id, req.params.userId, req.body
    );
    res.json({ status: 'success', data: member });
  }

  async markAsRead(req, res) {
    await conversationService.markAsRead(
      req.params.conversationId, req.user.id, req.body.message_id
    );
    res.json({ status: 'success', message: 'Marked as read' });
  }
}

module.exports = new ConversationController();
