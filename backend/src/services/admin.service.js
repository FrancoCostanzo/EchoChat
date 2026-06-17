const bcrypt = require('bcrypt');
const logger = require('../config/logger');
const { minioClient } = require('../config/minio');
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
      data_before: { username: user.username },
    });

    logger.info({ userId, actorId }, 'Admin soft-deleted user');
    return toAdminUserResponse(deleted, []);
  }

  async listRoles() {
    return userRepository.listRoles();
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
      data_before: { key, value: before.value },
      data_after: { key, value: updated.value },
    });

    logger.info({ key, actorId }, 'System setting updated');
    return toSettingResponse(updated);
  }

  // ── Audit (7.3) ───────────────────────────────────────────────────────────

  async getAuditLog(filters) {
    const rows = await auditRepository.search(filters);
    return rows.map(toAuditEntryResponse);
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
