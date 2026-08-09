import BaseRepository from './base.repository';
import type { Row } from '../types/rows';

type ListRow = Row<'broadcast_lists'>;
type BroadcastMessageRow = Row<'broadcast_messages'>;
type DeliveryRow = Row<'broadcast_deliveries'>;

/** Lista con el recuento de destinatarios que agrega la subconsulta. */
export type ListWithCount = ListRow & { recipient_count: number };

/** Destinatario con los datos del usuario que trae el JOIN. */
export type RecipientWithUser = Row<'broadcast_recipients'> & {
  username: string;
  display_name: string;
  department: string | null;
  avatar_bucket: string | null;
  avatar_object_key: string | null;
  presence: string | null;
};

/** Mensaje con el emisor y los totales de acuses en vivo. */
export type BroadcastMessageWithStats = BroadcastMessageRow & {
  sender_username: string;
  sender_display_name: string;
  sender_avatar_bucket: string | null;
  sender_avatar_object_key: string | null;
  total_sent: number;
  total_delivered: number;
  total_read: number;
};

/**
 * Fila de entrega: cruza el fan-out con el DM creado y sus acuses reales.
 * `sent_to_chat_at` es el momento del fan-out en el servidor; `received_at` y
 * `read_at` son lo que confirmó el cliente del destinatario.
 */
export interface DeliveryDetail {
  broadcast_msg_id: string;
  user_id: string;
  conversation_id: string | null;
  sent_to_chat_at: Date | null;
  legacy_read_at: Date | null;
  username: string;
  display_name: string;
  department: string | null;
  avatar_bucket: string | null;
  avatar_object_key: string | null;
  presence: string | null;
  message_id: string | null;
  received_at: Date | null;
  read_at: Date | null;
}

class BroadcastRepository extends BaseRepository<ListRow> {
  constructor() {
    super('broadcast_lists');
  }

  async createList(
    { name, description, owner_id }: { name: string; description?: string | null; owner_id: string },
  ): Promise<ListRow> {
    const { rows } = await this.query(
      `INSERT INTO broadcast_lists (name, description, owner_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, description || null, owner_id]
    );
    return rows[0];
  }

  async addRecipients(
    broadcastListId: string,
    userIds: string[] | undefined,
    addedBy: string,
  ): Promise<void> {
    if (!userIds?.length) return;
    for (const uid of userIds) {
      await this.query(
        `INSERT INTO broadcast_recipients (broadcast_list_id, user_id, added_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (broadcast_list_id, user_id) DO NOTHING`,
        [broadcastListId, uid, addedBy]
      );
    }
  }

  async removeRecipient(broadcastListId: string, userId: string): Promise<void> {
    await this.query(
      `DELETE FROM broadcast_recipients WHERE broadcast_list_id = $1 AND user_id = $2`,
      [broadcastListId, userId]
    );
  }

  async getRecipients(broadcastListId: string): Promise<RecipientWithUser[]> {
    const { rows } = await this.query<RecipientWithUser>(
      `SELECT br.*, u.username, u.display_name, u.department,
              u.avatar_bucket, u.avatar_object_key, u.presence
       FROM broadcast_recipients br
       JOIN users u ON u.id = br.user_id
       WHERE br.broadcast_list_id = $1
       ORDER BY u.display_name`,
      [broadcastListId]
    );
    return rows;
  }

  async findByOwner(ownerId: string): Promise<ListWithCount[]> {
    const { rows } = await this.query<ListWithCount>(
      `SELECT bl.*,
              (SELECT COUNT(*)::int FROM broadcast_recipients br
               WHERE br.broadcast_list_id = bl.id) AS recipient_count
       FROM broadcast_lists bl
       WHERE bl.owner_id = $1 AND bl.is_active = TRUE
       ORDER BY bl.updated_at DESC`,
      [ownerId]
    );
    return rows;
  }

  async createMessage(
    { broadcast_list_id, sender_id, body, type, object_id, scheduled_at }: {
      broadcast_list_id: string;
      sender_id: string;
      body: string;
      type?: string;
      object_id?: string | null;
      scheduled_at?: Date | string | null;
    },
  ): Promise<BroadcastMessageRow> {
    const isFuture = scheduled_at && new Date(scheduled_at) > new Date();
    const { rows } = await this.query<BroadcastMessageRow>(
      `INSERT INTO broadcast_messages (broadcast_list_id, sender_id, body, type, object_id, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [broadcast_list_id, sender_id, body, type || 'text', object_id || null,
       scheduled_at || null, isFuture ? 'scheduled' : 'draft']
    );
    return rows[0];
  }

  async findMessageById(id: string): Promise<BroadcastMessageRow | null> {
    const { rows } = await this.query<BroadcastMessageRow>(
      `SELECT * FROM broadcast_messages WHERE id = $1`, [id]
    );
    return rows[0] || null;
  }

  async findMessagesByListId(listId: string): Promise<BroadcastMessageWithStats[]> {
    // Live client-receipt totals (not denormalized fan-out counters).
    const { rows } = await this.query<BroadcastMessageWithStats>(
      `SELECT bm.*,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_bucket AS sender_avatar_bucket,
              u.avatar_object_key AS sender_avatar_object_key,
              COALESCE((
                SELECT COUNT(*)::int FROM broadcast_deliveries bd
                WHERE bd.broadcast_msg_id = bm.id AND bd.conversation_id IS NOT NULL
              ), 0) AS total_sent,
              COALESCE((
                SELECT COUNT(*)::int
                FROM message_receipts mr
                JOIN messages m ON m.id = mr.message_id
                WHERE (m.metadata->>'broadcast_msg_id') = bm.id::text
                  AND mr.delivered_at IS NOT NULL
              ), 0) AS total_delivered,
              COALESCE((
                SELECT COUNT(*)::int
                FROM message_receipts mr
                JOIN messages m ON m.id = mr.message_id
                WHERE (m.metadata->>'broadcast_msg_id') = bm.id::text
                  AND mr.read_at IS NOT NULL
              ), 0) AS total_read
       FROM broadcast_messages bm
       JOIN users u ON u.id = bm.sender_id
       WHERE bm.broadcast_list_id = $1
       ORDER BY bm.created_at DESC`,
      [listId]
    );
    return rows;
  }

  async getDeliveries(broadcastMsgId: string): Promise<DeliveryDetail[]> {
    // Join the fan-out row with the DM that was created and its real client
    // receipts (delivered/read). `bd.delivered_at` is the server fan-out time;
    // `mr.*` is what the recipient's client actually acknowledged.
    const { rows } = await this.query<DeliveryDetail>(
      `SELECT bd.broadcast_msg_id,
              bd.user_id,
              bd.conversation_id,
              bd.delivered_at AS sent_to_chat_at,
              bd.read_at AS legacy_read_at,
              u.username, u.display_name, u.department,
              u.avatar_bucket, u.avatar_object_key, u.presence,
              m.id AS message_id,
              mr.delivered_at AS received_at,
              mr.read_at AS read_at
       FROM broadcast_deliveries bd
       JOIN users u ON u.id = bd.user_id
       LEFT JOIN messages m
         ON m.conversation_id = bd.conversation_id
        AND m.deleted_at IS NULL
        AND (m.metadata->>'broadcast_msg_id') = bd.broadcast_msg_id::text
       LEFT JOIN message_receipts mr
         ON mr.message_id = m.id
        AND mr.user_id = bd.user_id
       WHERE bd.broadcast_msg_id = $1
       ORDER BY COALESCE(mr.read_at, mr.delivered_at, bd.delivered_at) DESC NULLS LAST,
                u.display_name`,
      [broadcastMsgId]
    );
    return rows;
  }

  async syncDeliveryReceipt(
    broadcastMsgId: string,
    userId: string,
    { received = false, read = false }: { received?: boolean; read?: boolean } = {},
  ): Promise<DeliveryRow | null> {
    const { rows } = await this.query<DeliveryRow>(
      `UPDATE broadcast_deliveries
       SET delivered_at = CASE
             WHEN $3 THEN COALESCE(delivered_at, NOW())
             ELSE delivered_at
           END,
           read_at = CASE
             WHEN $4 THEN NOW()
             ELSE read_at
           END
       WHERE broadcast_msg_id = $1 AND user_id = $2
       RETURNING *`,
      [broadcastMsgId, userId, received, read]
    );
    return rows[0] || null;
  }

  async refreshMessageTotals(broadcastMsgId: string): Promise<BroadcastMessageRow | null> {
    const { rows } = await this.query<BroadcastMessageRow>(
      `UPDATE broadcast_messages bm
       SET total_delivered = (
             SELECT COUNT(*)::int
             FROM message_receipts mr
             JOIN messages m ON m.id = mr.message_id
             WHERE (m.metadata->>'broadcast_msg_id') = bm.id::text
               AND mr.delivered_at IS NOT NULL
           ),
           total_read = (
             SELECT COUNT(*)::int
             FROM message_receipts mr
             JOIN messages m ON m.id = mr.message_id
             WHERE (m.metadata->>'broadcast_msg_id') = bm.id::text
               AND mr.read_at IS NOT NULL
           )
       WHERE bm.id = $1
       RETURNING *`,
      [broadcastMsgId]
    );
    return rows[0] || null;
  }

  async findDueScheduledMessages(limit = 50): Promise<BroadcastMessageRow[]> {
    const { rows } = await this.query<BroadcastMessageRow>(
      `SELECT * FROM broadcast_messages
       WHERE status = 'scheduled' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async updateMessageStatus(
    id: string,
    { status, sent_at, total_recipients, total_delivered, total_read }: {
      status?: string | null;
      sent_at?: Date | null;
      total_recipients?: number | null;
      total_delivered?: number | null;
      total_read?: number | null;
    },
  ): Promise<BroadcastMessageRow> {
    const { rows } = await this.query<BroadcastMessageRow>(
      `UPDATE broadcast_messages
       SET status = COALESCE($2, status),
           sent_at = COALESCE($3, sent_at),
           total_recipients = COALESCE($4, total_recipients),
           total_delivered = COALESCE($5, total_delivered),
           total_read = COALESCE($6, total_read)
       WHERE id = $1 RETURNING *`,
      [id, status || null, sent_at || null, total_recipients ?? null, total_delivered ?? null, total_read ?? null]
    );
    return rows[0];
  }

  async createDelivery(
    { broadcast_msg_id, user_id, conversation_id }: {
      broadcast_msg_id: string;
      user_id: string;
      conversation_id: string;
    },
  ): Promise<DeliveryRow> {
    // delivered_at here = "fan-out to DM succeeded" (server side). Client
    // receipt times live on message_receipts and are joined in getDeliveries.
    const { rows } = await this.query<DeliveryRow>(
      `INSERT INTO broadcast_deliveries (broadcast_msg_id, user_id, conversation_id, delivered_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (broadcast_msg_id, user_id) DO UPDATE
       SET conversation_id = EXCLUDED.conversation_id
       RETURNING *`,
      [broadcast_msg_id, user_id, conversation_id]
    );
    return rows[0];
  }

  async findUserIdsByDepartment(department: string): Promise<string[]> {
    const { rows } = await this.query<{ id: string }>(
      `SELECT id FROM users WHERE department = $1 AND status = 'active'`,
      [department]
    );
    return rows.map((r) => r.id);
  }
}

export = new BroadcastRepository();
