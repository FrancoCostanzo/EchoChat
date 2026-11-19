import BaseRepository from './base.repository';
import { decrypt } from '../utils/crypto.util';
import { now } from '../config/db/sql';
import type { DbTransaction } from '../config/db';
import type { Row } from '../types/rows';
import type { ConversationRow, MemberRow } from '../models/conversation.model';
import type {
  CreateConversationRequest,
  UpdateConversationRequest,
  UpdateMemberRequest,
} from '../dtos/conversation.dto';

type ConvRow = Row<'conversations'>;

/** Campos internos que también se escriben en conversation_members. */
type UpdateMemberFields = UpdateMemberRequest & {
  last_read_at?: Date;
  last_read_msg_id?: string;
};

/** Lista blanca → sólo las presentes en `fields` (para los UPDATE parciales). */
function pick<K extends string>(fields: Partial<Record<K, unknown>>, allowed: readonly K[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) out[key] = fields[key];
  }
  return out;
}

class ConversationRepository extends BaseRepository<ConvRow> {
  constructor() {
    super('conversations');
  }

  async create(
    { type, name, description, topic, is_discoverable, max_members, created_by }:
      Partial<CreateConversationRequest> & { type: string; created_by: string },
  ): Promise<ConvRow> {
    const row = await this.db.insertInto('conversations')
      .values({
        type,
        name: name || null,
        description: description || null,
        topic: topic || null,
        is_discoverable: is_discoverable ?? true,
        max_members: max_members || null,
        created_by,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as ConvRow;
  }

  async update(id: string, fields: UpdateConversationRequest): Promise<ConvRow | null> {
    const changes = pick(fields, ['name', 'description', 'topic', 'is_archived', 'is_read_only', 'is_discoverable', 'only_admins_edit_info', 'max_members'] as const);
    if (Object.keys(changes).length === 0) return this.findById(id);
    const row = await this.db.updateTable('conversations').set(changes).where('id', '=', id).returningAll().executeTakeFirst();
    return row as ConvRow;
  }

  async findDirectBetween(userId1: string, userId2: string): Promise<ConvRow | null> {
    const row = await this.db.selectFrom('conversations as c')
      .innerJoin('conversation_members as cm1', (j) => j.onRef('cm1.conversation_id', '=', 'c.id').on('cm1.user_id', '=', userId1))
      .innerJoin('conversation_members as cm2', (j) => j.onRef('cm2.conversation_id', '=', 'c.id').on('cm2.user_id', '=', userId2))
      .selectAll('c')
      .where('c.type', '=', 'direct')
      .where('cm1.left_at', 'is', null)
      .where('cm2.left_at', 'is', null)
      .limit(1)
      .executeTakeFirst();
    return (row as ConvRow | undefined) ?? null;
  }

  async findUserConversations(
    userId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<ConversationRow[]> {
    const rows = await this.db.selectFrom('conversations as c')
      .innerJoin('conversation_members as cm', 'cm.conversation_id', 'c.id')
      // En los directos, los datos del otro miembro.
      .leftJoinLateral(
        (eb) => eb.selectFrom('conversation_members as cm2')
          .innerJoin('users as u', 'u.id', 'cm2.user_id')
          .select(['u.id as user_id', 'u.display_name', 'u.username', 'u.presence', 'u.presence_message', 'u.avatar_object_key'])
          .whereRef('cm2.conversation_id', '=', 'c.id')
          .where('cm2.user_id', '<>', userId)
          .where('cm2.left_at', 'is', null)
          .limit(1)
          .as('other_user'),
        (j) => j.on('c.type', '=', 'direct'),
      )
      // Último mensaje, para el preview de la barra lateral.
      .leftJoin('messages as last_msg', 'last_msg.id', 'c.last_message_id')
      .selectAll('c')
      .select((eb) => [
        'cm.role as member_role',
        'cm.is_muted',
        'cm.muted_until',
        'cm.notification_level',
        'cm.is_pinned',
        'cm.last_read_msg_id',
        eb.selectFrom('messages as m')
          .select((s) => s.fn.countAll().as('n'))
          .whereRef('m.conversation_id', '=', 'c.id')
          .where('m.is_deleted', '=', false)
          .whereRef('m.sent_at', '>', (s) => s.fn.coalesce('cm.last_read_at', 'cm.joined_at'))
          .as('unread_count'),
        'other_user.user_id as other_user_id',
        'other_user.display_name as other_display_name',
        'other_user.username as other_username',
        'other_user.presence as member_presence',
        'other_user.presence_message as member_presence_message',
        'other_user.avatar_object_key as other_avatar_object_key',
        'last_msg.body as last_message_body',
        'last_msg.type as last_message_type',
        'last_msg.metadata as last_message_metadata',
      ])
      .where('cm.user_id', '=', userId)
      .where('cm.left_at', 'is', null)
      .where('cm.is_hidden', '=', false)
      .orderBy('cm.is_pinned', 'desc')
      // TODO(etapa 3): NULLS LAST no existe en SQL Server.
      .orderBy('c.last_message_at', (ob) => ob.desc().nullsLast())
      .limit(limit).offset(offset)
      .execute() as unknown as ConversationRow[];
    // El preview viene del body cifrado del último mensaje → descifrar.
    for (const row of rows) row.last_message_body = decrypt(row.last_message_body);
    return rows;
  }

  /** Apunta la conversación a un objeto de storage como foto (o lo saca con null). */
  async updateAvatar(conversationId: string, objectId: string | null): Promise<Row<'conversations'> | undefined> {
    const row = await this.db.updateTable('conversations')
      .set({ avatar_object_id: objectId, updated_at: now() })
      .where('id', '=', conversationId)
      .returningAll()
      .executeTakeFirst();
    return row as Row<'conversations'> | undefined;
  }

  /**
   * Recalcula `channel_settings.member_count` (sólo existe para canales). Antes
   * lo hacía el trigger fn_update_channel_member_count al cambiar los miembros.
   */
  private async refreshChannelMemberCount(trx: DbTransaction, conversationId: string): Promise<void> {
    await trx.updateTable('channel_settings')
      .set((eb) => ({
        member_count: eb.selectFrom('conversation_members as cm')
          .select((s) => s.cast<number>(s.fn.countAll(), 'integer').as('n'))
          .where('cm.conversation_id', '=', conversationId)
          .where('cm.left_at', 'is', null),
      }))
      .where('conversation_id', '=', conversationId)
      .execute();
  }

  async addMember(
    conversationId: string,
    userId: string,
    role = 'member',
    invitedBy: string | null = null,
  ): Promise<Row<'conversation_members'>> {
    return this.db.transaction().execute(async (trx) => {
      const row = await trx.insertInto('conversation_members')
        .values({ conversation_id: conversationId, user_id: userId, role, invited_by: invitedBy })
        .onConflict((oc) => oc.columns(['conversation_id', 'user_id']).doUpdateSet({ left_at: null, role, joined_at: now() }))
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.refreshChannelMemberCount(trx, conversationId);
      return row as Row<'conversation_members'>;
    });
  }

  async removeMember(
    conversationId: string,
    userId: string,
  ): Promise<Row<'conversation_members'> | undefined> {
    return this.db.transaction().execute(async (trx) => {
      const row = await trx.updateTable('conversation_members')
        .set({ left_at: now() })
        .where('conversation_id', '=', conversationId)
        .where('user_id', '=', userId)
        .where('left_at', 'is', null)
        .returningAll()
        .executeTakeFirst();
      await this.refreshChannelMemberCount(trx, conversationId);
      return row as Row<'conversation_members'> | undefined;
    });
  }

  private membersWithUser() {
    return this.db.selectFrom('conversation_members as cm')
      .innerJoin('users as u', 'u.id', 'cm.user_id')
      .selectAll('cm')
      .select(['u.username', 'u.display_name', 'u.avatar_object_key', 'u.presence']);
  }

  async getMember(conversationId: string, userId: string): Promise<MemberRow | null> {
    const row = await this.membersWithUser()
      .where('cm.conversation_id', '=', conversationId)
      .where('cm.user_id', '=', userId)
      .where('cm.left_at', 'is', null)
      .executeTakeFirst();
    return (row as unknown as MemberRow | undefined) ?? null;
  }

  /** Ids de todos los miembros activos, sin datos de usuario (para repartir avisos). */
  async getActiveMemberIds(conversationId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('conversation_members').select('user_id')
      .where('conversation_id', '=', conversationId)
      .where('left_at', 'is', null)
      .execute();
    return rows.map((r) => r.user_id);
  }

  /** De `userIds`, los que son miembros activos de la conversación. */
  async filterActiveMemberIds(conversationId: string, userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db.selectFrom('conversation_members').select('user_id')
      .where('conversation_id', '=', conversationId)
      .where('user_id', 'in', userIds)
      .where('left_at', 'is', null)
      .execute();
    return rows.map((r) => r.user_id);
  }

  async getMembers(
    conversationId: string,
    { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<MemberRow[]> {
    return this.membersWithUser()
      .where('cm.conversation_id', '=', conversationId)
      .where('cm.left_at', 'is', null)
      .orderBy('cm.role').orderBy('cm.joined_at')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<MemberRow[]>;
  }

  async updateMember(
    conversationId: string,
    userId: string,
    fields: UpdateMemberFields,
  ): Promise<Row<'conversation_members'> | null | undefined> {
    const changes = pick(fields, ['role', 'is_muted', 'muted_until', 'notification_level', 'is_pinned', 'is_hidden', 'last_read_at', 'last_read_msg_id'] as const);
    if (Object.keys(changes).length === 0) return null;
    const row = await this.db.updateTable('conversation_members')
      .set(changes)
      .where('conversation_id', '=', conversationId)
      .where('user_id', '=', userId)
      .where('left_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    return row as Row<'conversation_members'> | undefined;
  }

  async markAsRead(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<Row<'conversation_members'> | undefined> {
    const row = await this.db.updateTable('conversation_members')
      .set({ last_read_at: now(), last_read_msg_id: messageId })
      .where('conversation_id', '=', conversationId)
      .where('user_id', '=', userId)
      .where('left_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    return row as Row<'conversation_members'> | undefined;
  }
}

export default new ConversationRepository();
