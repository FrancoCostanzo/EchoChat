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

  async registrationStatus(req, res) {
    const allow = await authService.isRegistrationAllowed();
    res.json({ status: 'success', data: { allow_registration: allow } });
  }

  async login(req, res) {
    const result = await authService.login(req.body, req.ip, req.get('user-agent'));

    if (result.requires_2fa) {
      return res.json({
        status: 'success',
        data: { requires_2fa: true, temp_token: result.temp_token },
      });
    }

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
    // keepCurrent=true revokes all OTHER sessions but keeps the current one active
    const keepCurrent = req.query.keepCurrent === 'true';
    const exceptId = keepCurrent ? req.session?.id : null;
    await authService.logoutAll(req.user.id, exceptId);
    res.json({ status: 'success', message: 'Sessions revoked' });
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
    const currentSessionId = req.session?.id;
    const data = sessions.map((s) => ({ ...s, is_current: s.id === currentSessionId }));
    res.json({ status: 'success', data });
  }

  async revokeSession(req, res) {
    await authService.revokeSession(req.user.id, req.params.sessionId);
    res.json({ status: 'success', message: 'Session revoked' });
  }

  // ── 2FA ────────────────────────────────────────────────────────────────────

  async setup2fa(req, res) {
    const result = await authService.setupTotp(req.user.id);
    res.json({ status: 'success', data: result });
  }

  async enable2fa(req, res) {
    const result = await authService.enableTotp(req.user.id, req.body.code);
    res.json({ status: 'success', data: result });
  }

  async disable2fa(req, res) {
    await authService.disableTotp(req.user.id, req.body.password, req.body.code);
    res.json({ status: 'success', message: '2FA disabled' });
  }

  async verify2faChallenge(req, res) {
    const result = await authService.verifyTotpChallenge(
      {
        tempToken: req.body.temp_token,
        code: req.body.code,
        deviceName: req.body.device_name,
        deviceType: req.body.device_type,
      },
      req.ip,
      req.get('user-agent')
    );
    const user = await userService.getProfile(result.user.id);
    res.json({
      status: 'success',
      data: { user, token: result.token, expires_at: result.expires_at },
    });
  }

  async regenerateBackupCodes(req, res) {
    const result = await authService.regenerateBackupCodes(req.user.id, req.body.code);
    res.json({ status: 'success', data: result });
  }
}

module.exports = new AuthController();
