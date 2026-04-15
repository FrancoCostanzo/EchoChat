const { StatusCodes } = require('http-status-codes');
const { callService } = require('../services');

class CallController {
  async initiate(req, res) {
    const call = await callService.initiate(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: call });
  }

  async getById(req, res) {
    const call = await callService.getById(req.params.callId);
    res.json({ status: 'success', data: call });
  }

  async updateStatus(req, res) {
    const call = await callService.updateStatus(
      req.params.callId, req.user.id, req.body.status, req.body.end_reason
    );
    res.json({ status: 'success', data: call });
  }

  async updateParticipant(req, res) {
    const participant = await callService.updateParticipant(
      req.params.callId, req.params.userId, req.body
    );
    res.json({ status: 'success', data: participant });
  }

  async getByConversation(req, res) {
    const { limit = 20, offset = 0 } = req.query;
    const calls = await callService.getByConversation(
      req.params.conversationId,
      { limit: parseInt(limit, 10), offset: parseInt(offset, 10) }
    );
    res.json({ status: 'success', data: calls });
  }

  async getActive(req, res) {
    const calls = await callService.getActiveByUser(req.user.id);
    res.json({ status: 'success', data: calls });
  }
}

module.exports = new CallController();
