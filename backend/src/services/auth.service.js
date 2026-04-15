const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../config/logger');
const { userRepository, credentialRepository, sessionRepository, auditRepository } = require('../repositories');
const { UnauthorizedError, ConflictError, BadRequestError } = require('../errors');

const SALT_ROUNDS = 12;

class AuthService {
  async register(data, ip, userAgent) {
    const existing = await userRepository.findByUsername(data.username);
    if (existing) throw new ConflictError('Username already taken');

    if (data.email) {
      const emailExists = await userRepository.findByEmail(data.email);
      if (emailExists) throw new ConflictError('Email already registered');
    }

    const user = await userRepository.create(data);
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    await credentialRepository.create(user.id, passwordHash);

    // Assign default 'user' role
    await userRepository.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'user'`,
      [user.id]
    );

    await auditRepository.log({
      actor_id: user.id,
      action: 'user.register',
      resource_type: 'user',
      resource_id: user.id,
      ip_address: ip,
      user_agent: userAgent,
    });

    logger.info({ userId: user.id }, 'New user registered');
    return user;
  }

  async login({ username, password, device_name, device_type }, ip, userAgent) {
    const user = await userRepository.findByUsername(username);
    if (!user) throw new UnauthorizedError('Invalid credentials');
    if (user.status !== 'active') throw new UnauthorizedError('Account is not active');

    const creds = await credentialRepository.findByUserId(user.id);
    if (!creds) throw new UnauthorizedError('Invalid credentials');

    // Check lock
    if (creds.locked_until && new Date(creds.locked_until) > new Date()) {
      throw new UnauthorizedError('Account temporarily locked. Try again later.');
    }

    const valid = await bcrypt.compare(password, creds.password_hash);
    if (!valid) {
      await credentialRepository.incrementFailedAttempts(user.id);
      await auditRepository.log({
        actor_id: user.id,
        action: 'user.login',
        resource_type: 'user',
        resource_id: user.id,
        ip_address: ip,
        user_agent: userAgent,
        success: false,
        error_message: 'Invalid password',
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    await credentialRepository.resetFailedAttempts(user.id);

    const token = this._generateToken(user);
    const tokenHash = this._hashToken(token);
    const expiresAt = this._getTokenExpiry();

    await sessionRepository.create({
      userId: user.id,
      tokenHash,
      deviceName: device_name,
      deviceType: device_type || 'web',
      ipAddress: ip,
      userAgent,
      expiresAt,
    });

    await userRepository.updatePresence(user.id, 'online');

    await auditRepository.log({
      actor_id: user.id,
      action: 'user.login',
      resource_type: 'user',
      resource_id: user.id,
      ip_address: ip,
      user_agent: userAgent,
    });

    logger.info({ userId: user.id }, 'User logged in');
    return { user, token, expires_at: expiresAt };
  }

  async logout(userId, tokenHash) {
    const session = await sessionRepository.findActiveByTokenHash(tokenHash);
    if (session) {
      await sessionRepository.deactivate(session.id);
    }
    await userRepository.updatePresence(userId, 'offline');
    logger.info({ userId }, 'User logged out');
  }

  async logoutAll(userId) {
    await sessionRepository.deactivateAllForUser(userId);
    await userRepository.updatePresence(userId, 'offline');
    logger.info({ userId }, 'All sessions revoked');
  }

  async validateToken(token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      const tokenHash = this._hashToken(token);
      const session = await sessionRepository.findActiveByTokenHash(tokenHash);
      if (!session) throw new UnauthorizedError('Session expired or revoked');

      await sessionRepository.updateActivity(session.id);

      const user = await userRepository.findById(payload.sub);
      if (!user || user.status !== 'active') throw new UnauthorizedError('User not active');

      return { user, session };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid token');
    }
  }

  async changePassword(userId, currentPassword, newPassword, ip, userAgent) {
    const creds = await credentialRepository.findByUserId(userId);
    if (!creds) throw new BadRequestError('No credentials found');

    const valid = await bcrypt.compare(currentPassword, creds.password_hash);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await credentialRepository.updatePassword(userId, passwordHash);

    // Revoke all other sessions
    await sessionRepository.deactivateAllForUser(userId);

    await auditRepository.log({
      actor_id: userId,
      action: 'user.change_password',
      resource_type: 'user',
      resource_id: userId,
      ip_address: ip,
      user_agent: userAgent,
    });

    logger.info({ userId }, 'Password changed');
  }

  async getSessions(userId) {
    return sessionRepository.findActiveByUser(userId);
  }

  async revokeSession(userId, sessionId) {
    await sessionRepository.deactivate(sessionId);
    logger.info({ userId, sessionId }, 'Session revoked');
  }

  _generateToken(user) {
    return jwt.sign(
      { sub: user.id, username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  _getTokenExpiry() {
    const match = config.jwt.expiresIn.match(/^(\d+)([dhms])$/);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const num = parseInt(match[1], 10);
    const unit = { d: 86400000, h: 3600000, m: 60000, s: 1000 }[match[2]];
    return new Date(Date.now() + num * unit);
  }
}

module.exports = new AuthService();
