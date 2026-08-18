import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import QRCode from 'qrcode';
import config from '../config';
import logger from '../config/logger';
import { userRepository, credentialRepository, sessionRepository, auditRepository, systemSettingsRepository } from '../repositories';
import { UnauthorizedError, ConflictError, BadRequestError, ForbiddenError, NotFoundError } from '../errors';
// Require directo para evitar el ciclo services/index → auth.service.
import ldapService from './ldap.service';
import type { Row } from '../types/rows';
import type { RegisterRequest, LoginRequest, DeviceType } from '../dtos/auth.dto';
import type { OidcProfile } from './oidc.service';

const { TOTP, NobleCryptoPlugin, ScureBase32Plugin, generateSecret, generateURI } = require('otplib');

const SALT_ROUNDS = 12;
const APP_NAME = 'EchoChat';
const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });

type UserRow = Row<'users'>;

/** Sesión emitida: lo que devuelven todos los caminos de login. */
export interface SessionResult {
  user: UserRow;
  token: string;
  expires_at: Date;
}

/** Login local con 2FA activo: no hay sesión todavía, sólo el desafío. */
export interface TwoFactorChallenge {
  requires_2fa: true;
  temp_token: string;
}

/**
 * `config.jwt.secret` sale del entorno y es `string | undefined`: sin JWT_SECRET
 * la app no puede funcionar y esto revienta, igual que antes.
 */
const jwtSecret = () => config.jwt.secret as jwt.Secret;

/**
 * Verifica un JWT y garantiza que el payload sea un objeto.
 *
 * `jwt.verify` puede devolver un string cuando el token no lleva un payload JSON.
 * En ese caso `payload.sub` no sería el subject sino `String.prototype.sub` —el
 * método deprecado— y se terminaría buscando un usuario por una función. Acá se
 * corta ese camino de forma explícita.
 */
function verifyJwt(token: string): jwt.JwtPayload {
  const payload = jwt.verify(token, jwtSecret());
  if (typeof payload !== 'object' || payload === null) {
    throw new UnauthorizedError('Invalid token');
  }
  return payload;
}

class AuthService {
  async register(data: RegisterRequest, ip?: string | null, userAgent?: string | null) {
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

  async login(
    { username, password, device_name, device_type }: LoginRequest,
    ip?: string | null,
    userAgent?: string | null,
  ): Promise<SessionResult | TwoFactorChallenge> {
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
  async loginWithClaims(
    claims: OidcProfile,
    provider: string,
    { device_name, device_type }: { device_name?: string | null; device_type?: DeviceType } = {},
    ip?: string | null,
    userAgent?: string | null,
  ): Promise<SessionResult> {
    const { user, created } = await userRepository.upsertOidcUser(claims as any);

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
  async _createSession(
    user: UserRow,
    { device_name, device_type }: { device_name?: string | null; device_type?: DeviceType },
    ip?: string | null,
    userAgent?: string | null,
  ): Promise<SessionResult> {
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
  async isRegistrationAllowed(): Promise<boolean> {
    const setting = await systemSettingsRepository.findByKey('allow_registration');
    if (!setting) return true;
    return setting.value !== false && setting.value !== 'false';
  }

  async logout(userId: string, tokenHash: string): Promise<void> {
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

  async logoutAll(userId: string, exceptSessionId: string | null = null): Promise<void> {
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

  async validateToken(token: string) {
    try {
      const payload = verifyJwt(token);
      const tokenHash = this._hashToken(token);
      const session = await sessionRepository.findActiveByTokenHash(tokenHash);
      if (!session) throw new UnauthorizedError('Session expired or revoked');

      await sessionRepository.updateActivity(session.id);

      const user = await userRepository.findById(payload.sub as string);
      if (!user || user.status !== 'active') throw new UnauthorizedError('User not active');

      return { user, session };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid token');
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ip?: string | null,
    userAgent?: string | null,
  ): Promise<void> {
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

  async getSessions(userId: string) {
    return sessionRepository.findActiveByUser(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await sessionRepository.deactivate(sessionId);
    logger.info({ userId, sessionId }, 'Session revoked');
  }

  _generateToken(user: UserRow): string {
    return jwt.sign(
      // jti único: evita que dos logins del mismo usuario en el mismo segundo
      // produzcan un token idéntico (colisión de token_hash en user_sessions).
      { sub: user.id, username: user.username, jti: crypto.randomUUID() },
      jwtSecret(),
      // `expiresIn` viene del entorno como string suelto; @types/jsonwebtoken
      // espera un literal de duración ("7d"). Un valor inválido revienta al
      // firmar, igual que antes.
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );
  }

  _generateTempToken(user: UserRow): string {
    return jwt.sign(
      { sub: user.id, purpose: '2fa_pending' },
      jwtSecret(),
      { expiresIn: '5m' }
    );
  }

  // ── 2FA ────────────────────────────────────────────────────────────────────

  async setupTotp(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    const secret = generateSecret();
    const identifier = user.email || user.username;
    const otpauthUrl = generateURI({ label: `${APP_NAME}:${identifier}`, issuer: APP_NAME, secret });
    const qrCode = await QRCode.toDataURL(otpauthUrl);
    await credentialRepository.setTotpSecret(userId, secret);
    return { secret, qr_code: qrCode, otpauth_url: otpauthUrl };
  }

  async enableTotp(userId: string, code: string) {
    const creds = await credentialRepository.findByUserId(userId);
    // `creds` es null para quien se autentica por LDAP/OIDC y no tiene
    // credenciales locales: sin ellas no hay 2FA propio que configurar.
    if (!creds?.totp_secret) throw new BadRequestError('2FA setup not initiated');
    if (creds.totp_enabled) throw new BadRequestError('2FA already enabled');
    const isValid = await totp.verify(code, { secret: creds.totp_secret });
    if (!isValid?.valid) throw new UnauthorizedError('Invalid verification code');
    const backupCodes = this._generateBackupCodes();
    const hashedCodes = backupCodes.map((c) => this._hashBackupCode(c));
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

  async disableTotp(userId: string, password: string, code: string): Promise<void> {
    const creds = await credentialRepository.findByUserId(userId);
    if (!creds?.totp_enabled || !creds.totp_secret) throw new BadRequestError('2FA is not enabled');
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

  async verifyTotpChallenge(
    { tempToken, code, deviceName, deviceType }: {
      tempToken: string;
      code: string;
      deviceName?: string | null;
      deviceType?: DeviceType;
    },
    ip?: string | null,
    userAgent?: string | null,
  ): Promise<SessionResult> {
    let payload: jwt.JwtPayload;
    try {
      payload = verifyJwt(tempToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired challenge token');
    }
    if (payload.purpose !== '2fa_pending') throw new UnauthorizedError('Invalid token purpose');
    const userId = payload.sub as string;
    const user = await userRepository.findById(userId);
    if (!user || user.status !== 'active') throw new UnauthorizedError('User not found or inactive');
    const creds = await credentialRepository.findByUserId(userId);
    if (!creds?.totp_enabled) throw new UnauthorizedError('2FA not enabled');

    // Check backup code first
    const codeHash = this._hashBackupCode(code);
    const isBackup = (creds.totp_backup_codes || []).includes(codeHash);
    if (isBackup) {
      await credentialRepository.removeBackupCode(userId, codeHash);
      logger.info({ userId }, '2FA backup code used');
    } else if (!creds.totp_secret || !(await this._verifyTotp(code, creds.totp_secret))) {
      throw new UnauthorizedError('Invalid verification code');
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

  async regenerateBackupCodes(userId: string, code: string) {
    const creds = await credentialRepository.findByUserId(userId);
    if (!creds?.totp_enabled || !creds.totp_secret) throw new BadRequestError('2FA is not enabled');
    const isValid = await totp.verify(code, { secret: creds.totp_secret });
    if (!isValid?.valid) throw new UnauthorizedError('Invalid verification code');
    const backupCodes = this._generateBackupCodes();
    const hashedCodes = backupCodes.map((c) => this._hashBackupCode(c));
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

  _generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () => {
      const hex = crypto.randomBytes(5).toString('hex').toUpperCase();
      return `${hex.slice(0, 5)}-${hex.slice(5)}`;
    });
  }

  /**
   * Verifica un TOTP sin propagar excepciones. El desafío de login acepta
   * códigos de 5 a 15 caracteres porque ahí también entran los de respaldo, así
   * que a otplib puede llegarle algo que no es numérico: si tira, es un código
   * inválido (401), no un error del servidor (500).
   */
  async _verifyTotp(code: string, secret: string): Promise<boolean> {
    try {
      const resultado = await totp.verify(code, { secret });
      return resultado?.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Hash de un código de respaldo. Normaliza antes de hashear —saca guiones y
   * espacios y pasa a mayúsculas— para que el guardado y la verificación
   * coincidan sí o sí, y para que el usuario pueda tipear el código como
   * quiera. Tiene que ser el único lugar donde se hashea un código.
   */
  _hashBackupCode(code: string): string {
    const normalizado = String(code).replace(/[\s-]/g, '').toUpperCase();
    return crypto.createHash('sha256').update(normalizado).digest('hex');
  }

  _hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  _getTokenExpiry(): Date {
    const match = config.jwt.expiresIn.match(/^(\d+)([dhms])$/);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const num = parseInt(match[1], 10);
    const unit = ({ d: 86400000, h: 3600000, m: 60000, s: 1000 } as Record<string, number>)[match[2]];
    return new Date(Date.now() + num * unit);
  }
}

export default new AuthService();
