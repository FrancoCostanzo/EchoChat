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

  async sendMessage(req, res) {
    const message = await broadcastService.sendMessage(req.params.listId, req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }
}

module.exports = new BroadcastController();
