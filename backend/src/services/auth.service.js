const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { TOTP, NobleCryptoPlugin, ScureBase32Plugin, generateSecret, generateURI } = require('otplib');
const QRCode = require('qrcode');
const config = require('../config');
const logger = require('../config/logger');
const { userRepository, credentialRepository, sessionRepository, auditRepository, systemSettingsRepository } = require('../repositories');
const { UnauthorizedError, ConflictError, BadRequestError, ForbiddenError } = require('../errors');
// Require directo para evitar el ciclo services/index → auth.service.
const ldapService = require('./ldap.service');

const SALT_ROUNDS = 12;
const APP_NAME = 'EchoChat';
const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });

class AuthService {
  async register(data, ip, userAgent) {
    if (!(await this.isRegistrationAllowed())) {
      throw new ForbiddenError('El registro de nuevos usuarios está deshabilitado');
    }

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
      severity: 'info',
      category: 'auth',
      data_after: { username: user.username },
    });

    logger.info({ userId: user.id }, 'New user registered');
    return user;
  }

  async login({ username, password, device_name, device_type }, ip, userAgent) {
    const user = await userRepository.findByUsername(username);
    if (!user) throw new UnauthorizedError('Invalid credentials');
    if (user.status !== 'active') throw new UnauthorizedError('Account is not active');

    // Usuarios LDAP: la contraseña se valida por bind contra el directorio.
    // No tienen fila en user_credentials ni 2FA local en esta fase.
    if (user.auth_provider === 'ldap') {
      const ldapUser = await ldapService.authenticate(username, password);
      if (!ldapUser) {
        await auditRepository.log({
          actor_id: user.id,
          action: 'user.login',
          resource_type: 'user',
          resource_id: user.id,
          ip_address: ip,
          user_agent: userAgent,
          success: false,
          error_message: 'Invalid LDAP credentials',
          severity: 'warning',
          category: 'security',
          metadata: { provider: 'ldap' },
        });
        throw new UnauthorizedError('Invalid credentials');
      }
      return this._createSession(user, { device_name, device_type }, ip, userAgent);
    }

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
        severity: 'warning',
        category: 'security',
        metadata: { failed_attempts: (creds.failed_attempts || 0) + 1 },
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    await credentialRepository.resetFailedAttempts(user.id);

    // If 2FA is enabled, return a short-lived challenge token instead of a real session
    if (creds.totp_enabled) {
      const tempToken = this._generateTempToken(user);
      logger.info({ userId: user.id }, '2FA challenge issued');
      return { requires_2fa: true, temp_token: tempToken };
    }

    return this._createSession(user, { device_name, device_type }, ip, userAgent);
  }

  // Login por SSO/OIDC: el IdP ya autenticó al usuario y nos pasa sus claims mapeados.
  // Hace JIT provisioning (crea al usuario en el primer login), respeta el estado de
  // la cuenta y termina en el mismo _createSession que los demás caminos.
  async loginWithClaims(claims, provider, { device_name, device_type } = {}, ip, userAgent) {
    const { user, created } = await userRepository.upsertOidcUser(claims);

    if (created) {
      const role = config.oidc.defaultRole;
      if (role) await userRepository.setUserRoles(user.id, [role], null);
      await auditRepository.log({
        actor_id: user.id,
        action: 'user.sso_provision',
        resource_type: 'user',
        resource_id: user.id,
        ip_address: ip,
        user_agent: userAgent,
        severity: 'info',
        category: 'auth',
        metadata: { provider },
      });
      logger.info({ userId: user.id, provider }, 'SSO user provisioned (JIT)');
    }

    // Un admin pudo deshabilitar/borrar al usuario: el IdP no lo sabe, nosotros sí.
    if (user.status !== 'active') {
      await auditRepository.log({
        actor_id: user.id,
        action: 'user.login',
        resource_type: 'user',
        resource_id: user.id,
        ip_address: ip,
        user_agent: userAgent,
        success: false,
        error_message: 'Account is not active',
        severity: 'warning',
        category: 'security',
        metadata: { provider },
      });
      throw new UnauthorizedError('Account is not active');
    }

    return this._createSession(user, { device_name, device_type }, ip, userAgent);
  }

  // Emite token + sesión, marca presencia y audita un login exitoso.
  // Compartido por el camino local (sin 2FA), el LDAP y el SSO/OIDC.
  async _createSession(user, { device_name, device_type }, ip, userAgent) {
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
      severity: 'info',
      category: 'auth',
      metadata: { provider: user.auth_provider || 'local' },
    });

    logger.info({ userId: user.id, provider: user.auth_provider || 'local' }, 'User logged in');
    return { user, token, expires_at: expiresAt };
  }

  // Lee el toggle `allow_registration` (system_settings). Default permisivo si falta.
  async isRegistrationAllowed() {
    const setting = await systemSettingsRepository.findByKey('allow_registration');
    if (!setting) return true;
    return setting.value !== false && setting.value !== 'false';
  }

  async logout(userId, tokenHash) {
    const session = await sessionRepository.findActiveByTokenHash(tokenHash);
    if (session) {
      await sessionRepository.deactivate(session.id);
    }
    await userRepository.updatePresence(userId, 'offline');
    await auditRepository.log({
      actor_id: userId,
      action: 'user.logout',
      resource_type: 'user',
      resource_id: userId,
      severity: 'info',
      category: 'auth',
    });
    logger.info({ userId }, 'User logged out');
  }

  async logoutAll(userId, exceptSessionId = null) {
    await sessionRepository.deactivateAllForUser(userId, exceptSessionId);
    if (!exceptSessionId) await userRepository.updatePresence(userId, 'offline');
    await auditRepository.log({
      actor_id: userId,
      action: 'user.logout_all',
      resource_type: 'user',
      resource_id: userId,
      severity: 'warning',
      category: 'security',
      metadata: { keep_current: !!exceptSessionId },
    });
    logger.info({ userId, exceptSessionId }, 'Sessions revoked');
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

    await auditRepository.log({
      actor_id: userId,
      action: 'user.change_password',
      resource_type: 'user',
      resource_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'warning',
      category: 'security',
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

  _generateTempToken(user) {
    return jwt.sign(
      { sub: user.id, purpose: '2fa_pending' },
      config.jwt.secret,
      { expiresIn: '5m' }
    );
  }

  // ── 2FA ────────────────────────────────────────────────────────────────────

  async setupTotp(userId) {
    const user = await userRepository.findById(userId);
    const secret = generateSecret();
    const identifier = user.email || user.username;
    const otpauthUrl = generateURI({ label: `${APP_NAME}:${identifier}`, issuer: APP_NAME, secret });
    const qrCode = await QRCode.toDataURL(otpauthUrl);
    await credentialRepository.setTotpSecret(userId, secret);
    return { secret, qr_code: qrCode, otpauth_url: otpauthUrl };
  }

  async enableTotp(userId, code) {
    const creds = await credentialRepository.findByUserId(userId);
    if (!creds.totp_secret) throw new BadRequestError('2FA setup not initiated');
    if (creds.totp_enabled) throw new BadRequestError('2FA already enabled');
    const isValid = await totp.verify(code, { secret: creds.totp_secret });
    if (!isValid?.valid) throw new UnauthorizedError('Invalid verification code');
    const backupCodes = this._generateBackupCodes();
    const hashedCodes = backupCodes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex')
    );
    await credentialRepository.enableTotp(userId, hashedCodes);
    await auditRepository.log({
      actor_id: userId,
      action: 'user.2fa_enabled',
      resource_type: 'user',
      resource_id: userId,
      severity: 'warning',
      category: 'security',
    });
    logger.info({ userId }, '2FA enabled');
    return { backup_codes: backupCodes };
  }

  async disableTotp(userId, password, code) {
    const creds = await credentialRepository.findByUserId(userId);
    if (!creds.totp_enabled) throw new BadRequestError('2FA is not enabled');
    const validPw = await bcrypt.compare(password, creds.password_hash);
    if (!validPw) throw new UnauthorizedError('Invalid password');
    const isValid = await totp.verify(code, { secret: creds.totp_secret });
    if (!isValid?.valid) throw new UnauthorizedError('Invalid verification code');
    await credentialRepository.disableTotp(userId);
    await auditRepository.log({
      actor_id: userId,
      action: 'user.2fa_disabled',
      resource_type: 'user',
      resource_id: userId,
      severity: 'warning',
      category: 'security',
    });
    logger.info({ userId }, '2FA disabled');
  }

  async verifyTotpChallenge({ tempToken, code, deviceName, deviceType }, ip, userAgent) {
    let payload;
    try {
      payload = jwt.verify(tempToken, config.jwt.secret);
    } catch {
      throw new UnauthorizedError('Invalid or expired challenge token');
    }
    if (payload.purpose !== '2fa_pending') throw new UnauthorizedError('Invalid token purpose');
    const userId = payload.sub;
    const user = await userRepository.findById(userId);
    if (!user || user.status !== 'active') throw new UnauthorizedError('User not found or inactive');
    const creds = await credentialRepository.findByUserId(userId);
    if (!creds.totp_enabled) throw new UnauthorizedError('2FA not enabled');

    // Check backup code first
    const codeHash = crypto.createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
    const isBackup = (creds.totp_backup_codes || []).includes(codeHash);
    if (isBackup) {
      await credentialRepository.removeBackupCode(userId, codeHash);
      logger.info({ userId }, '2FA backup code used');
    } else {
      const isValid = await totp.verify(code, { secret: creds.totp_secret });
      if (!isValid?.valid) throw new UnauthorizedError('Invalid verification code');
    }

    const token = this._generateToken(user);
    const tokenHash = this._hashToken(token);
    const expiresAt = this._getTokenExpiry();
    await sessionRepository.create({
      userId,
      tokenHash,
      deviceName,
      deviceType: deviceType || 'web',
      ipAddress: ip,
      userAgent,
      expiresAt,
    });
    await userRepository.updatePresence(userId, 'online');
    await credentialRepository.resetFailedAttempts(userId);
    await auditRepository.log({
      actor_id: userId,
      action: isBackup ? 'user.2fa_backup_code_used' : 'user.2fa_login',
      resource_type: 'user',
      resource_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      severity: isBackup ? 'warning' : 'info',
      category: isBackup ? 'security' : 'auth',
    });
    logger.info({ userId }, 'User logged in via 2FA');
    return { user, token, expires_at: expiresAt };
  }

  async regenerateBackupCodes(userId, code) {
    const creds = await credentialRepository.findByUserId(userId);
    if (!creds.totp_enabled) throw new BadRequestError('2FA is not enabled');
    const isValid = await totp.verify(code, { secret: creds.totp_secret });
    if (!isValid?.valid) throw new UnauthorizedError('Invalid verification code');
    const backupCodes = this._generateBackupCodes();
    const hashedCodes = backupCodes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex')
    );
    await credentialRepository.updateBackupCodes(userId, hashedCodes);
    await auditRepository.log({
      actor_id: userId,
      action: 'user.2fa_backup_codes_regen',
      resource_type: 'user',
      resource_id: userId,
      severity: 'warning',
      category: 'security',
    });
    logger.info({ userId }, '2FA backup codes regenerated');
    return { backup_codes: backupCodes };
  }

  _generateBackupCodes() {
    return Array.from({ length: 8 }, () => {
      const hex = crypto.randomBytes(5).toString('hex').toUpperCase();
      return `${hex.slice(0, 5)}-${hex.slice(5)}`;
    });
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
