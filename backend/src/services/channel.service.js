const logger = require('../config/logger');
const {
  conversationRepository,
  channelRepository,
  notificationRepository,
} = require('../repositories');
const { NotFoundError, ForbiddenError, ConflictError, BadRequestError } = require('../errors');
const { toChannelResponse, toJoinRequestResponse } = require('../models');
const { toUser } = require('../config/eventBus');

const MANAGE_ROLES = ['owner', 'admin', 'moderator'];


class ChannelService {
  async createChannel(userId, data) {
    const conversation = await conversationRepository.create({
      type: 'channel',
      name: data.name,
      description: data.description,
      topic: data.topic,
      is_discoverable: data.is_discoverable,
      max_members: data.max_members,
      created_by: userId,
    });

    // Settings must exist before members are added so the member_count trigger
    // (fn_update_channel_member_count) has a row to update.
    await channelRepository.createSettings(conversation.id, {
      category: data.category,
      is_official: data.is_official,
      post_restriction: data.post_restriction,
      join_mode: data.join_mode,
    });

    await conversationRepository.addMember(conversation.id, userId, 'owner');
    for (const memberId of data.member_ids || []) {
      if (memberId !== userId) {
        await conversationRepository.addMember(conversation.id, memberId, 'member', userId);
      }
    }

    const settings = await channelRepository.getSettings(conversation.id);
    logger.info({ conversationId: conversation.id }, 'Channel created');
    return this._merge(conversation, settings);
  }

  async getChannel(conversationId, userId) {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== 'channel') throw new NotFoundError('Channel');
    const settings = await channelRepository.getSettings(conversationId);
    const member = await conversationRepository.getMember(conversationId, userId);
    return this._merge(conversation, settings, { is_member: !!member });
  }

  async listDiscoverable(userId, query) {
    const rows = await channelRepository.findDiscoverable(userId, query);
    return rows.map(toChannelResponse);
  }

  async updateSettings(conversationId, userId, data) {
    await this._requireManageRole(conversationId, userId);
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== 'channel') throw new NotFoundError('Channel');
    const settings = await channelRepository.updateSettings(conversationId, data);
    logger.info({ conversationId }, 'Channel settings updated');
    return this._merge(conversation, settings);
  }

  async join(conversationId, userId, message) {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== 'channel') throw new NotFoundError('Channel');

    const existing = await conversationRepository.getMember(conversationId, userId);
    if (existing) throw new ConflictError('Already a member of this channel');

    const settings = await channelRepository.getSettings(conversationId);
    const joinMode = settings?.join_mode || 'open';

    if (joinMode === 'invite_only') {
      throw new ForbiddenError('This channel is invite-only');
    }

    if (joinMode === 'request') {
      const pending = await channelRepository.findPendingRequest(conversationId, userId);
      if (pending) throw new ConflictError('A join request is already pending');
      const request = await channelRepository.createJoinRequest(conversationId, userId, message);
      await this._notifyManagers(conversationId, userId, conversation.name);
      logger.info({ conversationId, userId }, 'Channel join request created');
      return { status: 'requested', request: toJoinRequestResponse(request) };
    }

    // open
    const member = await conversationRepository.addMember(conversationId, userId, 'member');
    this._emitToUser(userId, 'channel:joined', { conversationId });
    logger.info({ conversationId, userId }, 'User joined open channel');
    return { status: 'joined', conversation_id: conversationId, member };
  }

  async listJoinRequests(conversationId, userId, query) {
    await this._requireManageRole(conversationId, userId);
    const rows = await channelRepository.listJoinRequests(conversationId, query);
    return rows.map(toJoinRequestResponse);
  }

  async reviewJoinRequest(conversationId, requestId, reviewerId, status) {
    await this._requireManageRole(conversationId, reviewerId);

    const request = await channelRepository.findRequestById(requestId);
    if (!request || request.conversation_id !== conversationId) throw new NotFoundError('Join request');
    if (request.status !== 'pending') throw new BadRequestError('Join request already reviewed');

    const updated = await channelRepository.reviewJoinRequest(requestId, reviewerId, status);
    if (!updated) throw new BadRequestError('Join request already reviewed');

    if (status === 'approved') {
      await conversationRepository.addMember(conversationId, request.user_id, 'member', reviewerId);
      this._emitToUser(request.user_id, 'channel:joined', { conversationId });
    }

    await notificationRepository.create({
      recipient_id: request.user_id,
      type: 'system',
      title: status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada',
      body: status === 'approved'
        ? 'Tu solicitud para unirte al canal fue aprobada'
        : 'Tu solicitud para unirte al canal fue rechazada',
      reference_type: 'conversation',
      reference_id: conversationId,
    });

    logger.info({ conversationId, requestId, status }, 'Channel join request reviewed');
    return toJoinRequestResponse(updated);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  _merge(conversation, settings, extra = {}) {
    return toChannelResponse({
      ...conversation,
      category: settings?.category ?? null,
      is_official: settings?.is_official ?? false,
      member_count: settings?.member_count ?? 0,
      post_restriction: settings?.post_restriction ?? 'members',
      join_mode: settings?.join_mode ?? 'open',
      ...extra,
    });
  }

  async _requireManageRole(conversationId, userId) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this channel');
    if (!MANAGE_ROLES.includes(member.role)) {
      throw new ForbiddenError('Insufficient role to manage this channel');
    }
    return member;
  }

  async _notifyManagers(conversationId, requesterId, channelName) {
    try {
      const members = await conversationRepository.getMembers(conversationId, { limit: 200 });
      const managers = members.filter((m) => MANAGE_ROLES.includes(m.role) && m.user_id !== requesterId);
      for (const manager of managers) {
        await notificationRepository.create({
          recipient_id: manager.user_id,
          type: 'system',
          title: 'Nueva solicitud de ingreso',
          body: `Hay una solicitud para unirse a ${channelName || 'un canal'}`,
          reference_type: 'conversation',
          reference_id: conversationId,
        });
        this._emitToUser(manager.user_id, 'channel:join_request', { conversationId });
      }
    } catch (err) {
      logger.warn({ err: err.message, conversationId }, 'Failed to notify channel managers');
    }
  }

  _emitToUser(userId, event, payload) {
    toUser(userId, event, payload);
  }
}

module.exports = new ChannelService();
