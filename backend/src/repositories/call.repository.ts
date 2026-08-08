import BaseRepository from './base.repository';
import type { Row } from '../types/rows';
import type { CallHistoryRow } from '../models/call.model';
import type { UpdateParticipantRequest } from '../dtos/call.dto';

type CallRow = Row<'calls'>;
type ParticipantRow = Row<'call_participants'>;

/** Participante con los datos del usuario que trae el JOIN. */
export type ParticipantWithUser = ParticipantRow & {
  username: string;
  display_name: string;
  avatar_object_key: string | null;
};

class CallRepository extends BaseRepository<CallRow> {
  constructor() {
    super('calls');
  }

  async create(
    { conversation_id, type, initiated_by }: {
      conversation_id?: string | null;
      type: string;
      initiated_by: string;
    },
  ): Promise<CallRow> {
    const { rows } = await this.query(
      `INSERT INTO calls (conversation_id, type, initiated_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [conversation_id || null, type, initiated_by]
    );
    return rows[0];
  }

  async updateStatus(id: string, status: string, endReason: string | null = null): Promise<CallRow> {
    const extras: string[] = [];
    const params: any[] = [status, id];

    if (status === 'active') {
      extras.push('answered_at = NOW()');
    }
    if (status === 'ended' || status === 'missed' || status === 'rejected' || status === 'failed') {
      extras.push(`ended_at = NOW()`);
      extras.push(`end_reason = $${params.length + 1}`);
      params.push(endReason);
    }

    const setClauses = [`status = $1`, ...extras].join(', ');
    const { rows } = await this.query(
      `UPDATE calls SET ${setClauses} WHERE id = $2 RETURNING *`,
      params
    );
    return rows[0];
  }

  async addParticipant(callId: string, userId: string): Promise<ParticipantRow | undefined> {
    const { rows } = await this.query<ParticipantRow>(
      `INSERT INTO call_participants (call_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (call_id, user_id) DO NOTHING
       RETURNING *`,
      [callId, userId]
    );
    return rows[0];
  }

  async updateParticipant(
    callId: string,
    userId: string,
    fields: UpdateParticipantRequest,
  ): Promise<ParticipantRow | null | undefined> {
    const allowed = ['status', 'can_speak', 'can_video', 'can_share_screen', 'is_muted_by_host'] as const;
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

    // Update timestamp columns based on status
    if (fields.status === 'joined') sets.push('joined_at = NOW()');
    if (['left', 'rejected', 'no_answer', 'busy'].includes(fields.status as string)) sets.push('left_at = NOW()');

    if (sets.length === 0) return null;

    values.push(callId, userId);
    const { rows } = await this.query<ParticipantRow>(
      `UPDATE call_participants SET ${sets.join(', ')}
       WHERE call_id = $${idx} AND user_id = $${idx + 1}
       RETURNING *`,
      values
    );
    return rows[0];
  }

  async getParticipants(callId: string): Promise<ParticipantWithUser[]> {
    const { rows } = await this.query<ParticipantWithUser>(
      `SELECT cp.*, u.username, u.display_name, u.avatar_object_key
       FROM call_participants cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.call_id = $1
       ORDER BY cp.invited_at`,
      [callId]
    );
    return rows;
  }

  async findByConversation(
    conversationId: string,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<CallRow[]> {
    const { rows } = await this.query(
      `SELECT * FROM calls
       WHERE conversation_id = $1
       ORDER BY initiated_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    return rows;
  }

  // Historial global de un usuario: todas las llamadas en las que participó,
  // a través de cualquier conversación, con el nombre a mostrar resuelto.
  async findByUser(
    userId: string,
    { limit = 50, offset = 0, filter }: { limit?: number; offset?: number; filter?: string } = {},
  ): Promise<CallHistoryRow[]> {
    const statusFilter = filter === 'missed'
      ? `AND c.status IN ('missed','rejected','failed')`
      : '';
    const { rows } = await this.query<CallHistoryRow>(
      `SELECT c.*,
              conv.type AS conversation_type,
              conv.name AS conversation_name,
              other.display_name AS other_display_name,
              other.avatar_object_key AS other_avatar_key
       FROM calls c
       JOIN call_participants cp ON cp.call_id = c.id AND cp.user_id = $1
       LEFT JOIN conversations conv ON conv.id = c.conversation_id
       LEFT JOIN LATERAL (
         SELECT u.display_name, u.avatar_object_key
         FROM conversation_members cm2
         JOIN users u ON u.id = cm2.user_id
         WHERE cm2.conversation_id = conv.id AND cm2.user_id <> $1
         LIMIT 1
       ) other ON conv.type = 'direct'
       WHERE cp.user_id = $1 ${statusFilter}
       ORDER BY c.initiated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }

  async findActiveByUser(userId: string): Promise<CallRow[]> {
    const { rows } = await this.query(
      `SELECT c.* FROM calls c
       JOIN call_participants cp ON cp.call_id = c.id
       WHERE cp.user_id = $1 AND c.status IN ('pending','ringing','active')
       ORDER BY c.initiated_at DESC`,
      [userId]
    );
    return rows;
  }
}

export = new CallRepository();
