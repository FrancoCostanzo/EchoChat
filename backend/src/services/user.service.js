const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { userRepository, credentialRepository, auditRepository } = require('../repositories');
const { autoAwayUsers } = require('../config/presenceStore');
const { minioClient } = require('../config/minio');
const { NotFoundError, BadRequestError } = require('../errors');
const { toUserResponse } = require('../models');

function getIO() {
  try {
    return require('../socket').getIO();
  } catch {
    return null;
  }
}

const AVATAR_BUCKET = 'messaging-avatars';
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

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
    logger.warn({ err }, 'Failed to generate avatar presigned URL');
    return user;
  }
}

class UserService {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    const creds = await credentialRepository.findByUserId(userId);
    const [permissions, roles] = await Promise.all([
      userRepository.getPermissionCodes(userId),
      userRepository.getRoleNames(userId),
    ]);
    const profile = await withAvatarUrl(toUserResponse(user));
    return { ...profile, totp_enabled: creds?.totp_enabled ?? false, roles, permissions };
  }

  async updateProfile(userId, data) {
    const before = await userRepository.findById(userId);
    const user = await userRepository.updateProfile(userId, data);
    if (!user) throw new NotFoundError('User');
    await auditRepository.log({
      actor_id: userId,
      action: 'user.profile_update',
      resource_type: 'user',
      resource_id: userId,
      severity: 'info',
      category: 'content',
      data_before: { display_name: before?.display_name, email: before?.email, department: before?.department, job_title: before?.job_title },
      data_after: data,
    });
    logger.info({ userId }, 'Profile updated');
    return withAvatarUrl(toUserResponse(user));
  }

  async uploadAvatar(userId, fileBuffer, mimeType, fileSize, originalFilename, opts = {}) {
    if (!AVATAR_ALLOWED_TYPES.includes(mimeType)) {
      throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
    }
    if (fileSize > AVATAR_MAX_SIZE) {
      throw new BadRequestError('File too large. Maximum size is 5 MB');
    }

    // Delete previous avatar from MinIO if it exists
    const current = await userRepository.findById(userId);
    if (!current || current.status === 'deleted') throw new NotFoundError('User');

    if (current.avatar_object_key) {
      try {
        await minioClient.removeObject(
          current.avatar_bucket || AVATAR_BUCKET,
          current.avatar_object_key,
        );
      } catch (err) {
        logger.warn({ err }, 'Failed to remove old avatar from MinIO');
      }
    }

    const ext = path.extname(originalFilename) || '.jpg';
    const objectKey = `avatars/${uuidv4()}${ext}`;

    await minioClient.putObject(AVATAR_BUCKET, objectKey, fileBuffer, fileSize, {
      'Content-Type': mimeType,
    });

    const user = await userRepository.updateAvatar(userId, AVATAR_BUCKET, objectKey);
    await auditRepository.log({
      actor_id: opts.actorId || userId,
      action: opts.action || 'user.avatar_update',
      resource_type: 'user',
      resource_id: userId,
      severity: opts.severity || 'info',
      category: opts.category || 'content',
      metadata: { mime_type: mimeType, size_bytes: fileSize },
      ip_address: opts.ip || null,
      user_agent: opts.userAgent || null,
    });
    logger.info({ userId, objectKey, actorId: opts.actorId || userId }, 'Avatar uploaded');
    return withAvatarUrl(toUserResponse(user));
  }

  async removeAvatar(userId, opts = {}) {
    const current = await userRepository.findById(userId);
    if (!current || current.status === 'deleted') throw new NotFoundError('User');

    if (current.avatar_object_key) {
      try {
        await minioClient.removeObject(
          current.avatar_bucket || AVATAR_BUCKET,
          current.avatar_object_key,
        );
      } catch (err) {
        logger.warn({ err }, 'Failed to remove avatar from MinIO');
      }
    }

    const user = await userRepository.clearAvatar(userId);
    await auditRepository.log({
      actor_id: opts.actorId || userId,
      action: opts.action || 'user.avatar_remove',
      resource_type: 'user',
      resource_id: userId,
      severity: opts.severity || 'info',
      category: opts.category || 'content',
      ip_address: opts.ip || null,
      user_agent: opts.userAgent || null,
    });
    logger.info({ userId, actorId: opts.actorId || userId }, 'Avatar removed');
    return withAvatarUrl(toUserResponse(user));
  }

  async updatePresence(userId, presence) {
    // A manual choice supersedes a job-set away.
    autoAwayUsers.delete(userId);
    const user = await userRepository.updatePresence(userId, presence);
    if (!user) throw new NotFoundError('User');
    try {
      getIO()?.emit('presence:changed', { userId, presence });
    } catch (err) {
      logger.warn({ err: err.message, userId }, 'Failed to emit presence:changed');
    }
    return toUserResponse(user);
  }

  async search(term, limit, offset) {
    const users = await userRepository.search(term, limit, offset);
    return Promise.all(users.map((u) => withAvatarUrl(toUserResponse(u))));
  }

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User');
    return toUserResponse(user);
  }
}

module.exports = new UserService();
