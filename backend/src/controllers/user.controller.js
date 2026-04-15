const { StatusCodes } = require('http-status-codes');
const { userService } = require('../services');

class UserController {
  async getProfile(req, res) {
    const user = await userService.getProfile(req.user.id);
    res.json({ status: 'success', data: user });
  }

  async updateProfile(req, res) {
    const user = await userService.updateProfile(req.user.id, req.body);
    res.json({ status: 'success', data: user });
  }

  async uploadAvatar(req, res) {
    if (!req.file) {
      return res.status(StatusCodes.BAD_REQUEST).json({ status: 'error', message: 'No file provided' });
    }
    const user = await userService.uploadAvatar(
      req.user.id,
      req.file.buffer,
      req.file.mimetype,
      req.file.size,
      req.file.originalname,
    );
    res.json({ status: 'success', data: user });
  }

  async updatePresence(req, res) {
    const user = await userService.updatePresence(req.user.id, req.body.presence);
    res.json({ status: 'success', data: user });
  }

  async search(req, res) {
    const { q, limit = 20, offset = 0 } = req.query;
    const users = await userService.search(q, parseInt(limit, 10), parseInt(offset, 10));
    res.json({ status: 'success', data: users });
  }

  async getUserById(req, res) {
    const user = await userService.getUserById(req.params.userId);
    res.json({ status: 'success', data: user });
  }
}

module.exports = new UserController();
