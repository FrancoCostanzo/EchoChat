const { StatusCodes } = require('http-status-codes');
const { channelService } = require('../services');

class ChannelController {
  async create(req, res) {
    const channel = await channelService.createChannel(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: channel });
  }

  async discover(req, res) {
    const { search, category, limit = 30, offset = 0 } = req.query;
    const channels = await channelService.listDiscoverable(req.user.id, {
      search,
      category,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json({ status: 'success', data: channels });
  }

  async getById(req, res) {
    const channel = await channelService.getChannel(req.params.conversationId, req.user.id);
    res.json({ status: 'success', data: channel });
  }

  async updateSettings(req, res) {
    const channel = await channelService.updateSettings(req.params.conversationId, req.user.id, req.body);
    res.json({ status: 'success', data: channel });
  }

  async join(req, res) {
    const result = await channelService.join(req.params.conversationId, req.user.id, req.body?.message);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: result });
  }

  async listRequests(req, res) {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;
    const requests = await channelService.listJoinRequests(req.params.conversationId, req.user.id, {
      status,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json({ status: 'success', data: requests });
  }

  async reviewRequest(req, res) {
    const request = await channelService.reviewJoinRequest(
      req.params.conversationId, req.params.requestId, req.user.id, req.body.status
    );
    res.json({ status: 'success', data: request });
  }
}

module.exports = new ChannelController();
