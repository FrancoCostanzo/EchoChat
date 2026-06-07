const { StatusCodes } = require('http-status-codes');
const { pollService } = require('../services');

class PollController {
  async create(req, res) {
    const message = await pollService.createPoll(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }

  async vote(req, res) {
    const poll = await pollService.vote(req.user.id, req.params.pollId, req.body.option_ids);
    res.json({ status: 'success', data: poll });
  }

  async retract(req, res) {
    const poll = await pollService.retractVote(req.user.id, req.params.pollId);
    res.json({ status: 'success', data: poll });
  }

  async close(req, res) {
    const poll = await pollService.close(req.user.id, req.params.pollId);
    res.json({ status: 'success', data: poll });
  }
}

module.exports = new PollController();
