import logger from '../config/logger';
import {
  conversationRepository,
  channelRepository,
  notificationRepository,
} from '../repositories';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../errors';
import { toChannelResponse, toJoinRequestResponse } from '../models';
import { toUser } from '../config/eventBus';
import type { Row } from '../types/rows';
import type { CreateChannelRequest, UpdateChannelSettingsRequest } from '../dtos/channel.dto';

const MANAGE_ROLES = ['owner', 'admin', 'moderator'];

class ChannelService {
  async createChannel(userId: string, data: CreateChannelRequest) {
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

  async getChannel(conversationId: string, userId: string) {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== 'channel') throw new NotFoundError('Channel');
    const settings = await channelRepository.getSettings(conversationId);
    const member = await conversationRepository.getMember(conversationId, userId);
    return this._merge(conversation, settings, { is_member: !!member });
  }

  async listDiscoverable(
    userId: string,
    query?: { search?: string; category?: string; limit?: number; offset?: number },
  ) {
    const rows = await channelRepository.findDiscoverable(userId, query);
    return rows.map(toChannelResponse);
  }

  async updateSettings(
    conversationId: string,
    userId: string,
    data: UpdateChannelSettingsRequest,
  ) {
    await this._requireManageRole(conversationId, userId);
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== 'channel') throw new NotFoundError('Channel');
    const settings = await channelRepository.updateSettings(conversationId, data);
    logger.info({ conversationId }, 'Channel settings updated');
    return this._merge(conversation, settings);
  }

  async join(conversationId: string, userId: string, message?: string | null) {
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

  async listJoinRequests(
    conversationId: string,
    userId: string,
    query?: { status?: string; limit?: number; offset?: number },
  ) {
    await this._requireManageRole(conversationId, userId);
    const rows = await channelRepository.listJoinRequests(conversationId, query);
    return rows.map(toJoinRequestResponse);
  }

  async reviewJoinRequest(
    conversationId: string,
    requestId: string,
    reviewerId: string,
    status: string,
  ) {
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
  /** Un canal es una conversación + su fila de channel_settings, aplanadas. */
  _merge(
    conversation: Row<'conversations'>,
    settings: Row<'channel_settings'> | null,
    extra: Record<string, unknown> = {},
  ) {
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

  async _requireManageRole(conversationId: string, userId: string) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this channel');
    if (!MANAGE_ROLES.includes(member.role as string)) {
      throw new ForbiddenError('Insufficient role to manage this channel');
    }
    return member;
  }

  async _notifyManagers(conversationId: string, requesterId: string, channelName: string | null) {
    try {
      const members = await conversationRepository.getMembers(conversationId, { limit: 200 });
      const managers = members.filter((m) => MANAGE_ROLES.includes(m.role as string) && m.user_id !== requesterId);
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
      logger.warn({ err: (err as Error).message, conversationId }, 'Failed to notify channel managers');
    }
  }

  _emitToUser(userId: string, event: string, payload: unknown) {
    toUser(userId, event, payload);
  }
}

export default new ChannelService();
