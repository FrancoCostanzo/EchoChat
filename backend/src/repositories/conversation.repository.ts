import BaseRepository from './base.repository';
import { decrypt } from '../utils/crypto.util';
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

class ConversationRepository extends BaseRepository<ConvRow> {
  constructor() {
    super('conversations');
  }

  async create(
    { type, name, description, topic, is_discoverable, max_members, created_by }:
      Partial<CreateConversationRequest> & { type: string; created_by: string },
  ): Promise<ConvRow> {
    const { rows } = await this.query(
      `INSERT INTO conversations (type, name, description, topic, is_discoverable, max_members, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [type, name || null, description || null, topic || null, is_discoverable ?? true, max_members || null, created_by]
    );
    return rows[0];
  }

  async update(id: string, fields: UpdateConversationRequest): Promise<ConvRow | null> {
    const allowed = ['name', 'description', 'topic', 'is_archived', 'is_read_only', 'is_discoverable', 'max_members'] as const;
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }
    if (sets.length === 0) return this.findById(id);

    values.push(id);
    const { rows } = await this.query(
      `UPDATE conversations SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0];
  }

  async findDirectBetween(userId1: string, userId2: string): Promise<ConvRow | null> {
    const { rows } = await this.query(
      `SELECT c.* FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2
       WHERE c.type = 'direct' AND cm1.left_at IS NULL AND cm2.left_at IS NULL
       LIMIT 1`,
      [userId1, userId2]
    );
    return rows[0] || null;
  }

  async findUserConversations(
    userId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<ConversationRow[]> {
    const { rows } = await this.query<ConversationRow>(
      `SELECT c.*,
              cm.role AS member_role,
              cm.is_muted,
              cm.is_pinned,
              cm.last_read_msg_id,
              (SELECT COUNT(*) FROM messages m
               WHERE m.conversation_id = c.id
                 AND m.is_deleted = FALSE
                 AND m.sent_at > COALESCE(cm.last_read_at, cm.joined_at)
              ) AS unread_count,
              -- For direct conversations: other member info
              other_user.user_id       AS other_user_id,
              other_user.display_name AS other_display_name,
              other_user.username     AS other_username,
              other_user.presence     AS member_presence,
              other_user.presence_message AS member_presence_message,
              other_user.avatar_object_key AS other_avatar_object_key,
              -- Last message body for sidebar preview
              last_msg.body AS last_message_body,
              last_msg.type AS last_message_type,
              last_msg.metadata AS last_message_metadata
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       LEFT JOIN LATERAL (
         SELECT u.id AS user_id, u.display_name, u.username, u.presence, u.presence_message, u.avatar_object_key
         FROM conversation_members cm2
         JOIN users u ON u.id = cm2.user_id
         WHERE cm2.conversation_id = c.id
           AND cm2.user_id <> $1
           AND cm2.left_at IS NULL
         LIMIT 1
       ) other_user ON c.type = 'direct'
       LEFT JOIN messages last_msg ON last_msg.id = c.last_message_id
       WHERE cm.user_id = $1
         AND cm.left_at IS NULL
         AND cm.is_hidden = FALSE
       ORDER BY cm.is_pinned DESC, c.last_message_at DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    // El preview viene del body cifrado del último mensaje → descifrar.
    for (const row of rows) row.last_message_body = decrypt(row.last_message_body);
    return rows;
  }

  /** Apunta la conversación a un objeto de storage como foto (o lo saca con null). */
  async updateAvatar(conversationId: string, objectId: string | null): Promise<Row<'conversations'> | undefined> {
    const { rows } = await this.query<Row<'conversations'>>(
      `UPDATE conversations SET avatar_object_id = $2, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [conversationId, objectId]
    );
    return rows[0];
  }

  async addMember(
    conversationId: string,
    userId: string,
    role = 'member',
    invitedBy: string | null = null,
  ): Promise<Row<'conversation_members'>> {
    const { rows } = await this.query<Row<'conversation_members'>>(
      `INSERT INTO conversation_members (conversation_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (conversation_id, user_id)
       DO UPDATE SET left_at = NULL, role = $3, joined_at = NOW()
       RETURNING *`,
      [conversationId, userId, role, invitedBy]
    );
    return rows[0];
  }

  async removeMember(
    conversationId: string,
    userId: string,
  ): Promise<Row<'conversation_members'> | undefined> {
    const { rows } = await this.query<Row<'conversation_members'>>(
      `UPDATE conversation_members SET left_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL
       RETURNING *`,
      [conversationId, userId]
    );
    return rows[0];
  }

  async getMember(conversationId: string, userId: string): Promise<MemberRow | null> {
    const { rows } = await this.query<MemberRow>(
      `SELECT cm.*, u.username, u.display_name, u.avatar_object_key, u.presence
       FROM conversation_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL`,
      [conversationId, userId]
    );
    return rows[0] || null;
  }

  async getMembers(
    conversationId: string,
    { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<MemberRow[]> {
    const { rows } = await this.query<MemberRow>(
      `SELECT cm.*, u.username, u.display_name, u.avatar_object_key, u.presence
       FROM conversation_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = $1 AND cm.left_at IS NULL
       ORDER BY cm.role, cm.joined_at
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    return rows;
  }

  async updateMember(
    conversationId: string,
    userId: string,
    fields: UpdateMemberFields,
  ): Promise<Row<'conversation_members'> | null | undefined> {
    const allowed = ['role', 'is_muted', 'muted_until', 'is_pinned', 'is_hidden', 'last_read_at', 'last_read_msg_id'] as const;
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }
    if (sets.length === 0) return null;

    values.push(conversationId, userId);
    const { rows } = await this.query<Row<'conversation_members'>>(
      `UPDATE conversation_members SET ${sets.join(', ')}
       WHERE conversation_id = $${idx} AND user_id = $${idx + 1} AND left_at IS NULL
       RETURNING *`,
      values
    );
    return rows[0];
  }

  async markAsRead(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<Row<'conversation_members'> | undefined> {
    const { rows } = await this.query<Row<'conversation_members'>>(
      `UPDATE conversation_members
       SET last_read_at = NOW(), last_read_msg_id = $3
       WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL
       RETURNING *`,
      [conversationId, userId, messageId]
    );
    return rows[0];
  }
}

export default new ConversationRepository();
