const { StatusCodes } = require('http-status-codes');
const { authService, userService } = require('../services');
const { toUserResponse } = require('../models');

class AuthController {
  async register(req, res) {
    const user = await authService.register(req.body, req.ip, req.get('user-agent'));
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: toUserResponse(user),
    });
  }

  async login(req, res) {
    const result = await authService.login(req.body, req.ip, req.get('user-agent'));
    const user = await userService.getProfile(result.user.id);
    res.json({
      status: 'success',
      data: {
        user,
        token: result.token,
        expires_at: result.expires_at,
      },
    });
  }

  async logout(req, res) {
    const crypto = require('crypto');
    const token = req.headers.authorization?.split(' ')[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await authService.logout(req.user.id, tokenHash);
    res.json({ status: 'success', message: 'Logged out' });
  }

  async logoutAll(req, res) {
    await authService.logoutAll(req.user.id);
    res.json({ status: 'success', message: 'All sessions revoked' });
  }

  async me(req, res) {
    const user = await userService.getProfile(req.user.id);
    res.json({
      status: 'success',
      data: user,
    });
  }

  async changePassword(req, res) {
    await authService.changePassword(
      req.user.id,
      req.body.current_password,
      req.body.new_password,
      req.ip,
      req.get('user-agent')
    );
    res.json({ status: 'success', message: 'Password changed' });
  }

  async getSessions(req, res) {
    const sessions = await authService.getSessions(req.user.id);
    res.json({ status: 'success', data: sessions });
  }

  async revokeSession(req, res) {
    await authService.revokeSession(req.user.id, req.params.sessionId);
    res.json({ status: 'success', message: 'Session revoked' });
  }
}

module.exports = new AuthController();
