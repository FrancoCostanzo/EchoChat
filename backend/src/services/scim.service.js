const config = require('../config');
const logger = require('../config/logger');
const { userRepository, auditRepository } = require('../repositories');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors');

function sanitizeUsername(raw) {
  if (!raw) return null;
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');
}

class ScimService {
  // Extrae los campos que nos interesan de un recurso User de SCIM.
  _fromScim(payload = {}) {
    const emails = Array.isArray(payload.emails) ? payload.emails : [];
    const primaryEmail = (emails.find((e) => e.primary) || emails[0])?.value || null;
    const nameFromParts = [payload.name?.givenName, payload.name?.familyName].filter(Boolean).join(' ');
    const displayName = payload.displayName || payload.name?.formatted || nameFromParts || payload.userName || null;
    return {
      username: sanitizeUsername(payload.userName),
      display_name: displayName,
      email: primaryEmail,
      external_id: payload.externalId ? `scim:${payload.externalId}` : null,
      active: payload.active !== false, // ausente = activo
    };
  }

  // Parsea el subconjunto de filtros SCIM que usan los IdPs: `attr eq "valor"`.
  parseFilter(filter) {
    if (!filter) return {};
    const m = String(filter).match(/(\w+)\s+eq\s+"([^"]*)"/i);
    if (!m) return { unsupported: true };
    const attr = m[1].toLowerCase();
    const value = m[2];
    if (attr === 'username') return { username: sanitizeUsername(value) };
    if (attr === 'externalid') return { externalId: value };
    return { unsupported: true };
  }

  async list({ filter, startIndex = 1, count = 100 }) {
    const parsed = this.parseFilter(filter);
    // Un filtro no soportado no es un error: devolvemos lista vacía (el IdP interpreta
    // que el recurso no existe y procede a crearlo).
    if (parsed.unsupported) return { rows: [], total: 0, startIndex, count };
    const offset = Math.max(0, startIndex - 1);
    const { rows, total } = await userRepository.listScimUsers({
      username: parsed.username,
      externalId: parsed.externalId,
      limit: count,
      offset,
    });
    return { rows, total, startIndex, count };
  }

  async getById(id) {
    const user = await userRepository.findScimById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async create(payload, ctx = {}) {
    const data = this._fromScim(payload);
    if (!data.username) throw new BadRequestError('userName es requerido');

    // userName debe ser único (semántica SCIM).
    const existing = await userRepository.findByUsername(data.username);
    if (existing) throw new ConflictError('userName ya existe');

    const created = await userRepository.create({
      username: data.username,
      display_name: data.display_name,
      email: data.email,
      auth_provider: 'scim',
      external_id: data.external_id,
    });
    if (!data.active) await userRepository.updateStatus(created.id, 'suspended');
    if (config.scim.defaultRole) {
      await userRepository.setUserRoles(created.id, [config.scim.defaultRole], null);
    }

    await this._audit('user.scim_provision', created.id, ctx, { username: created.username, active: data.active });
    logger.info({ userId: created.id, username: created.username }, 'SCIM user provisioned');
    return userRepository.findById(created.id);
  }

  // PUT: reemplazo completo del recurso.
  async replace(id, payload, ctx = {}) {
    const user = await this.getById(id);
    const data = this._fromScim(payload);
    await userRepository.updateProfile(id, {
      display_name: data.display_name ?? user.display_name,
      email: data.email,
    });
    await this._applyActive(user, data.active, ctx);
    return userRepository.findById(id);
  }

  // PATCH: operaciones parciales. La clave para los IdPs es active=false (baja).
  async patch(id, body, ctx = {}) {
    const user = await this.getById(id);
    const ops = Array.isArray(body?.Operations) ? body.Operations : [];
    if (ops.length === 0) throw new BadRequestError('PATCH sin Operations');

    const profile = {};
    let nextActive;

    for (const op of ops) {
      const kind = String(op.op || '').toLowerCase();
      if (kind === 'remove') continue; // no soportamos remove de atributos individuales
      const path = op.path ? String(op.path).toLowerCase() : null;
      const value = op.value;

      if (path === 'active') nextActive = this._toBool(value);
      else if (path === 'displayname') profile.display_name = value;
      else if (path === 'emails' || path === 'emails[primary eq true].value') {
        profile.email = Array.isArray(value) ? (value[0]?.value ?? value[0]) : value;
      } else if (path === 'name.formatted' || path === 'displayname') profile.display_name = value;
      else if (!path && value && typeof value === 'object') {
        // Azure suele mandar {op:'replace', value:{ active:false, ... }} sin path.
        if ('active' in value) nextActive = this._toBool(value.active);
        if (value.displayName) profile.display_name = value.displayName;
        const emails = value.emails;
        if (Array.isArray(emails) && emails.length) profile.email = emails[0].value;
      }
    }

    if (Object.keys(profile).length) await userRepository.updateProfile(id, profile);
    if (nextActive !== undefined) await this._applyActive(user, nextActive, ctx);
    return userRepository.findById(id);
  }

  async remove(id, ctx = {}) {
    const user = await this.getById(id);
    await userRepository.softDelete(id);
    await this._audit('user.scim_deprovision', id, ctx, { username: user.username, method: 'delete' });
    logger.info({ userId: id }, 'SCIM user deprovisioned (delete)');
  }

  // Aplica el flag active respetando el ciclo de vida: al desactivar, revoca sesiones.
  async _applyActive(user, active, ctx) {
    if (active === undefined) return;
    const target = active ? 'active' : 'suspended';
    if (user.status === target) return;
    await userRepository.updateStatus(user.id, target);
    if (!active) {
      const { sessionRepository } = require('../repositories');
      await sessionRepository.deactivateAllForUser(user.id).catch(() => {});
      await userRepository.updatePresence(user.id, 'offline').catch(() => {});
      await this._audit('user.scim_deprovision', user.id, ctx, { username: user.username, method: 'deactivate' });
      logger.info({ userId: user.id }, 'SCIM user deactivated');
    } else {
      await this._audit('user.scim_reactivate', user.id, ctx, { username: user.username });
    }
  }

  _toBool(v) {
    if (typeof v === 'boolean') return v;
    return String(v).toLowerCase() === 'true';
  }

  _audit(action, userId, ctx, metadata) {
    return auditRepository.log({
      actor_id: null,
      action,
      resource_type: 'user',
      resource_id: userId,
      ip_address: ctx.ip || null,
      user_agent: ctx.userAgent || null,
      severity: action.includes('deprovision') ? 'warning' : 'info',
      category: 'admin',
      metadata: { ...metadata, provider: 'scim' },
    }).catch(() => {});
  }
}

module.exports = new ScimService();
