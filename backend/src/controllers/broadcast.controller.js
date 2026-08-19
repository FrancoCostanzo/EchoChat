const { StatusCodes } = require('http-status-codes');
const { broadcastService } = require('../services');

class BroadcastController {
  async createList(req, res) {
    const list = await broadcastService.createList(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: list });
  }

  async getLists(req, res) {
    const lists = await broadcastService.getLists(req.user.id);
    res.json({ status: 'success', data: lists });
  }

  async getListById(req, res) {
    const list = await broadcastService.getListById(req.params.listId, req.user.id);
    res.json({ status: 'success', data: list });
  }

  async getMessages(req, res) {
    const messages = await broadcastService.getMessages(req.params.listId, req.user.id);
    res.json({ status: 'success', data: messages });
  }

  async getDeliveries(req, res) {
    const deliveries = await broadcastService.getDeliveries(
      req.params.listId,
      req.params.messageId,
      req.user.id,
    );
    res.json({ status: 'success', data: deliveries });
  }

  async sendMessage(req, res) {
    const message = await broadcastService.sendMessage(req.params.listId, req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }

  async addRecipients(req, res) {
    const recipients = await broadcastService.addRecipients(
      req.params.listId,
      req.user.id,
      req.body,
    );
    res.status(StatusCodes.CREATED).json({ status: 'success', data: recipients });
  }

  async removeRecipient(req, res) {
    const recipients = await broadcastService.removeRecipient(
      req.params.listId,
      req.user.id,
      req.params.userId,
    );
    res.json({ status: 'success', data: recipients });
  }
}

module.exports = new BroadcastController();
