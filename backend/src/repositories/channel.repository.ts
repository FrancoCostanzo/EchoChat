import BaseRepository from './base.repository';
import { now, ilike } from '../config/db/sql';
import type { Row } from '../types/rows';
import type { ChannelRow, JoinRequestRow } from '../models/channel.model';
import type { CreateChannelRequest, UpdateChannelSettingsRequest } from '../dtos/channel.dto';

type SettingsRow = Row<'channel_settings'>;

// Handles channel-specific tables: channel_settings (1:1 with a conversation of
// type 'channel') and channel_join_requests.
class ChannelRepository extends BaseRepository<SettingsRow> {
  constructor() {
    super('channel_settings');
  }

  async createSettings(
    conversationId: string,
    { category, is_official, post_restriction, join_mode }: Partial<CreateChannelRequest>,
  ): Promise<SettingsRow> {
    const row = await this.db.insertInto('channel_settings')
      .values({
        conversation_id: conversationId,
        category: category || null,
        is_official: is_official ?? false,
        post_restriction: post_restriction || 'members',
        join_mode: join_mode || 'open',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as SettingsRow;
  }

  async getSettings(conversationId: string): Promise<SettingsRow | null> {
    const row = await this.db.selectFrom('channel_settings').selectAll()
      .where('conversation_id', '=', conversationId)
      .executeTakeFirst();
    return (row as SettingsRow | undefined) ?? null;
  }

  async updateSettings(
    conversationId: string,
    fields: UpdateChannelSettingsRequest,
  ): Promise<SettingsRow | null> {
    const allowed = ['category', 'is_official', 'post_restriction', 'join_mode'] as const;
    const changes: Record<string, unknown> = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) changes[key] = fields[key];
    }
    if (Object.keys(changes).length === 0) return this.getSettings(conversationId);

    const row = await this.db.updateTable('channel_settings')
      .set(changes)
      .where('conversation_id', '=', conversationId)
      .returningAll()
      .executeTakeFirst();
    return (row as SettingsRow | undefined) ?? null;
  }

  // Discoverable channels, with the requesting user's membership/request state.
  async findDiscoverable(
    userId: string,
    { search, category, limit = 30, offset = 0 }: {
      search?: string;
      category?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<ChannelRow[]> {
    let q = this.db.selectFrom('conversations as c')
      .innerJoin('channel_settings as cs', 'cs.conversation_id', 'c.id')
      .select((eb) => [
        'c.id', 'c.name', 'c.description', 'c.topic', 'c.avatar_object_id', 'c.max_members', 'c.created_at',
        'cs.category', 'cs.is_official', 'cs.member_count', 'cs.post_restriction', 'cs.join_mode',
        eb.exists(eb.selectFrom('conversation_members as cm').select('cm.user_id')
          .whereRef('cm.conversation_id', '=', 'c.id')
          .where('cm.user_id', '=', userId)
          .where('cm.left_at', 'is', null)).as('is_member'),
        eb.selectFrom('conversation_members as cm').select('cm.role')
          .whereRef('cm.conversation_id', '=', 'c.id')
          .where('cm.user_id', '=', userId)
          .where('cm.left_at', 'is', null)
          .limit(1)
          .as('member_role'),
        eb.exists(eb.selectFrom('channel_join_requests as jr').select('jr.id')
          .whereRef('jr.conversation_id', '=', 'c.id')
          .where('jr.user_id', '=', userId)
          .where('jr.status', '=', 'pending')).as('has_pending_request'),
      ])
      .where('c.type', '=', 'channel')
      .where('c.is_discoverable', '=', true)
      .where('c.is_archived', '=', false);

    if (search) {
      const pattern = `%${search}%`;
      q = q.where((eb) => eb.or([ilike('c.name', pattern), ilike('c.description', pattern)]));
    }
    if (category) q = q.where('cs.category', '=', category);

    return q
      .orderBy('cs.is_official', 'desc')
      .orderBy('cs.member_count', 'desc')
      .orderBy('c.created_at', 'desc')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<ChannelRow[]>;
  }

  // ── Join requests ─────────────────────────────────────────────────────────
  async createJoinRequest(
    conversationId: string,
    userId: string,
    message?: string | null,
  ): Promise<Row<'channel_join_requests'>> {
    const row = await this.db.insertInto('channel_join_requests')
      .values({ conversation_id: conversationId, user_id: userId, message: message || null })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as Row<'channel_join_requests'>;
  }

  async findPendingRequest(
    conversationId: string,
    userId: string,
  ): Promise<Row<'channel_join_requests'> | null> {
    const row = await this.db.selectFrom('channel_join_requests').selectAll()
      .where('conversation_id', '=', conversationId)
      .where('user_id', '=', userId)
      .where('status', '=', 'pending')
      .limit(1)
      .executeTakeFirst();
    return (row as Row<'channel_join_requests'> | undefined) ?? null;
  }

  async findRequestById(requestId: string): Promise<Row<'channel_join_requests'> | null> {
    const row = await this.db.selectFrom('channel_join_requests').selectAll().where('id', '=', requestId).executeTakeFirst();
    return (row as Row<'channel_join_requests'> | undefined) ?? null;
  }

  async listJoinRequests(
    conversationId: string,
    { status = 'pending', limit = 50, offset = 0 }: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<JoinRequestRow[]> {
    return this.db.selectFrom('channel_join_requests as jr')
      .innerJoin('users as u', 'u.id', 'jr.user_id')
      .selectAll('jr')
      .select(['u.username', 'u.display_name', 'u.avatar_object_key', 'u.department'])
      .where('jr.conversation_id', '=', conversationId)
      .where('jr.status', '=', status)
      .orderBy('jr.created_at', 'asc')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<JoinRequestRow[]>;
  }

  async reviewJoinRequest(
    requestId: string,
    reviewerId: string,
    status: string,
  ): Promise<Row<'channel_join_requests'> | null> {
    const row = await this.db.updateTable('channel_join_requests')
      .set({ status, reviewed_by: reviewerId, reviewed_at: now() })
      .where('id', '=', requestId)
      .where('status', '=', 'pending')
      .returningAll()
      .executeTakeFirst();
    return (row as Row<'channel_join_requests'> | undefined) ?? null;
  }
}

export default new ChannelRepository();
