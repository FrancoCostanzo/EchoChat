const bcrypt = require('bcrypt');
const config = require('../config');
const logger = require('../config/logger');
const { minioClient } = require('../config/minio');
// Require directo (no vía ../services) para evitar dependencia circular.
const ldapService = require('./ldap.service');
const oidcService = require('./oidc.service');
const {
  userRepository,
  credentialRepository,
  sessionRepository,
  auditRepository,
  systemSettingsRepository,
  storageRepository,
} = require('../repositories');
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} = require('../errors');
const {
  toAdminUserResponse,
  toSettingResponse,
  toAuditEntryResponse,
  toStorageObjectAdminResponse,
} = require('../models');

const SALT_ROUNDS = 12;
const AVATAR_BUCKET = 'messaging-avatars';

// Adds a 24h presigned `avatar_url` from the stored MinIO object key.
// Admin responses carry avatar_object_key/bucket but, unlike the user
// service, were never presigned — so the admin table fell back to initials.
async function withAvatarUrl(user) {
  if (!user || !user.avatar_object_key) return user;
  try {
    const url = await minioClient.presignedGetObject(
      user.avatar_bucket || AVATAR_BUCKET,
      user.avatar_object_key,
      60 * 60 * 24, // 24 h
    );
    return { ...user, avatar_url: url };
  } catch (err) {
    logger.warn({ err }, 'Failed to generate avatar presigned URL (admin)');
    return user;
  }
}

class AdminService {
  // ── Users (7.1) ───────────────────────────────────────────────────────────

  async listUsers(filters) {
    const users = await userRepository.listUsers(filters);
    const enriched = await Promise.all(
      users.map(async (u) => {
        const roles = await userRepository.getUserRoles(u.id);
        return withAvatarUrl(toAdminUserResponse(u, roles));
      }),
    );
    return enriched;
  }

  async createUser(actorId, data, ip, userAgent) {
    const existing = await userRepository.findByUsername(data.username);
    if (existing) throw new ConflictError('Username already taken');

    if (data.email) {
      const emailExists = await userRepository.findByEmail(data.email);
      if (emailExists) throw new ConflictError('Email already registered');
    }

    const user = await userRepository.create(data);
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    await credentialRepository.create(user.id, passwordHash);

    const roleNames = data.role_names?.length ? data.role_names : ['user'];
    await userRepository.setUserRoles(user.id, roleNames, actorId);

    await auditRepository.log({
      actor_id: actorId,
      action: 'admin.user_create',
      resource_type: 'user',
      resource_id: user.id,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'info',
      category: 'admin',
      data_after: { username: user.username, roles: roleNames },
    });

    logger.info({ userId: user.id, actorId }, 'Admin created user');
    const roles = await userRepository.getUserRoles(user.id);
    return toAdminUserResponse(user, roles);
  }

  async updateUser(actorId, userId, data, ip, userAgent) {
    if (actorId === userId && data.status && data.status !== 'active') {
      throw new ForbiddenError('Cannot change your own account status');
    }

    const before = await userRepository.findById(userId);
    if (!before || before.status === 'deleted') throw new NotFoundError('User');

    let user = before;

    if (data.role_names) {
      await this._guardLastSuperAdmin(userId, data.role_names);
      await userRepository.setUserRoles(userId, data.role_names, actorId);
    }

    const profileFields = {};
    for (const key of ['display_name', 'email', 'department', 'job_title']) {
      if (data[key] !== undefined) profileFields[key] = data[key];
    }
    if (Object.keys(profileFields).length) {
      user = await userRepository.updateProfile(userId, profileFields);
    }

    if (data.status) {
      user = await userRepository.updateStatus(userId, data.status);
      if (data.status !== 'active') {
        await sessionRepository.deactivateAllForUser(userId);
      }
    }

    await auditRepository.log({
      actor_id: actorId,
      action: 'admin.user_update',
      resource_type: 'user',
      resource_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'warning',
      category: 'admin',
      data_before: { status: before.status },
      data_after: { status: user.status, roles: data.role_names },
    });

    const roles = await userRepository.getUserRoles(userId);
    return toAdminUserResponse(user, roles);
  }

  async deleteUser(actorId, userId, ip, userAgent) {
    if (actorId === userId) throw new ForbiddenError('Cannot delete your own account');

    const user = await userRepository.findById(userId);
    if (!user || user.status === 'deleted') throw new NotFoundError('User');

    const roles = await userRepository.getUserRoles(userId);
    const roleNames = roles.map((r) => r.name);
    if (roleNames.includes('super_admin')) {
      await this._guardLastSuperAdmin(userId, roleNames.filter((r) => r !== 'super_admin'));
    }

    const deleted = await userRepository.softDelete(userId);
    await sessionRepository.deactivateAllForUser(userId);

    await auditRepository.log({
      actor_id: actorId,
      action: 'admin.user_delete',
      resource_type: 'user',
      resource_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'critical',
      category: 'admin',
      data_before: { username: user.username, roles: roleNames },
    });

    logger.info({ userId, actorId }, 'Admin soft-deleted user');
    return toAdminUserResponse(deleted, []);
  }

  async resetUserPassword(actorId, userId, newPassword, ip, userAgent) {
    const user = await userRepository.findById(userId);
    if (!user || user.status === 'deleted') throw new NotFoundError('User');
    if (user.auth_provider === 'ldap') {
      throw new BadRequestError('Los usuarios LDAP gestionan su contraseña en el directorio');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const creds = await credentialRepository.findByUserId(userId);
    if (creds) {
      await credentialRepository.updatePassword(userId, passwordHash);
    } else {
      await credentialRepository.create(userId, passwordHash);
    }
    // Forzar re-login en todos los dispositivos del usuario.
    await sessionRepository.deactivateAllForUser(userId);

    await auditRepository.log({
      actor_id: actorId,
      action: 'admin.user_reset_password',
      resource_type: 'user',
      resource_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'warning',
      category: 'admin',
      data_after: { username: user.username },
    });

    logger.info({ userId, actorId }, 'Admin reset user password');
    return { id: userId };
  }

  async listRoles() {
    return userRepository.listRoles();
  }

  // ── LDAP (importación manual) ───────────────────────────────────────────

  getLdapStatus() {
    return ldapService.status();
  }

  // Estado agregado de las integraciones de identidad para el panel de admin.
  getIntegrations() {
    return {
      ldap: ldapService.status(),
      sso: {
        enabled: oidcService.isEnabled(),
        providers: oidcService.listProviders(),
      },
    };
  }

  // Compat: la importación manual desde el panel admin delega en el sync unificado.
  async importLdapUsers(actorId, ip, userAgent) {
    return this.syncLdapUsers({ actorId, ip, userAgent, origin: 'manual' });
  }

  // Sincronización LDAP compartida por la importación manual (con actor) y el job
  // cron (actorId null, origin 'automatic'). Crea/actualiza usuarios, opcionalmente
  // mapea grupos→roles y deshabilita a los que ya no están en el directorio.
  async syncLdapUsers({ actorId = null, ip = null, userAgent = null, origin = 'manual' } = {}) {
    const entries = await ldapService.fetchAllUsers();
    const seenExternalIds = [];
    let created = 0;
    let updated = 0;
    let reactivated = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        const { user, created: wasCreated, reactivated: wasReactivated } =
          await userRepository.upsertLdapUser(entry);
        seenExternalIds.push(entry.external_id);
        if (wasCreated) created += 1;
        else updated += 1;
        if (wasReactivated) reactivated += 1;

        await this._applyLdapRoles(user.id, entry, wasCreated, actorId);
      } catch (err) {
        failed += 1;
        logger.warn({ err, username: entry.username }, 'LDAP user sync failed');
      }
    }

    // Deprovisioning: sólo si está activado y el fetch trajo usuarios (guarda anti-apagón).
    let disabled = 0;
    if (config.ldap.deprovision && seenExternalIds.length > 0) {
      const disabledIds = await userRepository.disableLdapUsersNotIn(seenExternalIds);
      disabled = disabledIds.length;
      for (const uid of disabledIds) {
        await sessionRepository.deactivateAllForUser(uid).catch(() => {});
        await userRepository.updatePresence(uid, 'offline').catch(() => {});
      }
    }

    const summary = { total: entries.length, created, updated, reactivated, disabled, failed };

    await auditRepository.log({
      actor_id: actorId,
      action: 'admin.ldap_sync',
      resource_type: 'system',
      resource_id: null,
      ip_address: ip,
      user_agent: userAgent,
      severity: failed > 0 || disabled > 0 ? 'warning' : 'info',
      category: 'admin',
      metadata: { origin },
      data_after: summary,
    });

    logger.info({ actorId, origin, ...summary }, 'LDAP sync completed');
    return summary;
  }

  // Asigna roles a un usuario LDAP. Con syncRoles activo, los roles son 100%
  // dirigidos por los grupos del directorio (reemplaza los actuales); sin mapeo
  // aplicable cae al rol por defecto para no dejar al usuario sin acceso. Sin
  // syncRoles, sólo asigna el rol por defecto a los recién creados (no toca updates).
  async _applyLdapRoles(userId, entry, wasCreated, actorId) {
    const { syncRoles, defaultRole } = config.ldap;
    if (syncRoles) {
      const mapped = ldapService.mapGroupsToRoles(entry.groups);
      const roles = mapped.length ? mapped : (defaultRole ? [defaultRole] : []);
      if (roles.length) await userRepository.setUserRoles(userId, roles, actorId);
    } else if (wasCreated && defaultRole) {
      await userRepository.setUserRoles(userId, [defaultRole], actorId);
    }
  }

  async _guardLastSuperAdmin(userId, newRoleNames) {
    const currentRoles = await userRepository.getUserRoles(userId);
    const wasSuperAdmin = currentRoles.some((r) => r.name === 'super_admin');
    const willBeSuperAdmin = newRoleNames.includes('super_admin');
    if (wasSuperAdmin && !willBeSuperAdmin) {
      const count = await userRepository.countUsersWithRole('super_admin');
      if (count <= 1) {
        throw new BadRequestError('Cannot remove the last super_admin');
      }
    }
  }

  // ── Settings (7.2) ──────────────────────────────────────────────────────

  async getSettings() {
    const rows = await systemSettingsRepository.findAll();
    return rows.map(toSettingResponse);
  }

  async updateSetting(actorId, key, value, ip, userAgent) {
    const before = await systemSettingsRepository.findByKey(key);
    if (!before) throw new NotFoundError('Setting');

    const updated = await systemSettingsRepository.update(key, value, actorId);

    await auditRepository.log({
      actor_id: actorId,
      action: 'admin.setting_update',
      resource_type: 'system_setting',
      resource_id: null,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'warning',
      category: 'admin',
      data_before: { key, value: before.value },
      data_after: { key, value: updated.value },
    });

    logger.info({ key, actorId }, 'System setting updated');
    return toSettingResponse(updated);
  }

  // ── Audit (7.3) ───────────────────────────────────────────────────────────

  async getAuditLog(filters) {
    const { rows, total } = await auditRepository.searchWithCount(filters);
    return { entries: rows.map(toAuditEntryResponse), total };
  }

  // ── Storage (7.4) ──────────────────────────────────────────────────────────

  async getStorageStats() {
    return storageRepository.getStats();
  }

  async listStorageObjects(filters) {
    const rows = await storageRepository.listObjects(filters);
    return rows.map(toStorageObjectAdminResponse);
  }
}

module.exports = new AdminService();
