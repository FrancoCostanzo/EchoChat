import type { ExpressionBuilder } from 'kysely';
import BaseRepository from './base.repository';
import { now, jsonText, asText } from '../config/db/sql';
import type { DB } from '../types/db';
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
    const row = await this.db.insertInto('broadcast_lists')
      .values({ name, description: description || null, owner_id })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as ListRow;
  }

  async addRecipients(
    broadcastListId: string,
    userIds: string[] | undefined,
    addedBy: string,
  ): Promise<void> {
    if (!userIds?.length) return;
    for (const uid of userIds) {
      await this.db.insertInto('broadcast_recipients')
        .values({ broadcast_list_id: broadcastListId, user_id: uid, added_by: addedBy })
        .onConflict((oc) => oc.columns(['broadcast_list_id', 'user_id']).doNothing())
        .execute();
    }
  }

  async removeRecipient(broadcastListId: string, userId: string): Promise<void> {
    await this.db.deleteFrom('broadcast_recipients')
      .where('broadcast_list_id', '=', broadcastListId)
      .where('user_id', '=', userId)
      .execute();
  }

  async getRecipients(broadcastListId: string): Promise<RecipientWithUser[]> {
    return this.db.selectFrom('broadcast_recipients as br')
      .innerJoin('users as u', 'u.id', 'br.user_id')
      .selectAll('br')
      .select(['u.username', 'u.display_name', 'u.department', 'u.avatar_bucket', 'u.avatar_object_key', 'u.presence'])
      .where('br.broadcast_list_id', '=', broadcastListId)
      .orderBy('u.display_name')
      .execute() as unknown as Promise<RecipientWithUser[]>;
  }

  async findByOwner(ownerId: string): Promise<ListWithCount[]> {
    return this.db.selectFrom('broadcast_lists as bl')
      .selectAll('bl')
      .select((eb) => eb.selectFrom('broadcast_recipients as br')
        .select((s) => s.cast<number>(s.fn.countAll(), 'integer').as('n'))
        .whereRef('br.broadcast_list_id', '=', 'bl.id')
        .as('recipient_count'))
      .where('bl.owner_id', '=', ownerId)
      .where('bl.is_active', '=', true)
      .orderBy('bl.updated_at', 'desc')
      .execute() as unknown as Promise<ListWithCount[]>;
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
    const row = await this.db.insertInto('broadcast_messages')
      .values({
        broadcast_list_id,
        sender_id,
        body,
        type: type || 'text',
        object_id: object_id || null,
        scheduled_at: scheduled_at || null,
        status: isFuture ? 'scheduled' : 'draft',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as BroadcastMessageRow;
  }

  async findMessageById(id: string): Promise<BroadcastMessageRow | null> {
    const row = await this.db.selectFrom('broadcast_messages').selectAll().where('id', '=', id).executeTakeFirst();
    return (row as BroadcastMessageRow | undefined) ?? null;
  }

  /**
   * Acuses de los DMs que generó una difusión (`messages.metadata.broadcast_msg_id`):
   * cuántos se entregaron o leyeron. Subconsulta correlacionada sobre `bm.id`.
   */
  private receiptCount(eb: ExpressionBuilder<DB & { bm: DB['broadcast_messages'] }, 'bm'>, column: 'delivered_at' | 'read_at') {
    return eb.selectFrom('message_receipts as mr')
      .innerJoin('messages as m', 'm.id', 'mr.message_id')
      .select((s) => s.cast<number>(s.fn.countAll(), 'integer').as('n'))
      .where(jsonText('m.metadata', 'broadcast_msg_id'), '=', asText('bm.id'))
      .where(`mr.${column}`, 'is not', null);
  }

  async findMessagesByListId(listId: string): Promise<BroadcastMessageWithStats[]> {
    // Live client-receipt totals (not denormalized fan-out counters).
    return this.db.selectFrom('broadcast_messages as bm')
      .innerJoin('users as u', 'u.id', 'bm.sender_id')
      .selectAll('bm')
      .select((eb) => [
        'u.username as sender_username',
        'u.display_name as sender_display_name',
        'u.avatar_bucket as sender_avatar_bucket',
        'u.avatar_object_key as sender_avatar_object_key',
        eb.fn.coalesce(
          eb.selectFrom('broadcast_deliveries as bd')
            .select((s) => s.cast<number>(s.fn.countAll(), 'integer').as('n'))
            .whereRef('bd.broadcast_msg_id', '=', 'bm.id')
            .where('bd.conversation_id', 'is not', null),
          eb.lit(0),
        ).as('total_sent'),
        eb.fn.coalesce(this.receiptCount(eb, 'delivered_at'), eb.lit(0)).as('total_delivered'),
        eb.fn.coalesce(this.receiptCount(eb, 'read_at'), eb.lit(0)).as('total_read'),
      ])
      .where('bm.broadcast_list_id', '=', listId)
      .orderBy('bm.created_at', 'desc')
      .execute() as unknown as Promise<BroadcastMessageWithStats[]>;
  }

  async getDeliveries(broadcastMsgId: string): Promise<DeliveryDetail[]> {
    // Join the fan-out row with the DM that was created and its real client
    // receipts (delivered/read). `bd.delivered_at` is the server fan-out time;
    // `mr.*` is what the recipient's client actually acknowledged.
    return this.db.selectFrom('broadcast_deliveries as bd')
      .innerJoin('users as u', 'u.id', 'bd.user_id')
      .leftJoin('messages as m', (j) => j
        .onRef('m.conversation_id', '=', 'bd.conversation_id')
        .on('m.deleted_at', 'is', null)
        .on(jsonText('m.metadata', 'broadcast_msg_id'), '=', asText('bd.broadcast_msg_id')))
      .leftJoin('message_receipts as mr', (j) => j
        .onRef('mr.message_id', '=', 'm.id')
        .onRef('mr.user_id', '=', 'bd.user_id'))
      .select([
        'bd.broadcast_msg_id',
        'bd.user_id',
        'bd.conversation_id',
        'bd.delivered_at as sent_to_chat_at',
        'bd.read_at as legacy_read_at',
        'u.username', 'u.display_name', 'u.department',
        'u.avatar_bucket', 'u.avatar_object_key', 'u.presence',
        'm.id as message_id',
        'mr.delivered_at as received_at',
        'mr.read_at as read_at',
      ])
      .where('bd.broadcast_msg_id', '=', broadcastMsgId)
      // TODO(etapa 3): NULLS LAST no existe en SQL Server.
      .orderBy((eb) => eb.fn.coalesce('mr.read_at', 'mr.delivered_at', 'bd.delivered_at'), (ob) => ob.desc().nullsLast())
      .orderBy('u.display_name')
      .execute() as unknown as Promise<DeliveryDetail[]>;
  }

  async syncDeliveryReceipt(
    broadcastMsgId: string,
    userId: string,
    { received = false, read = false }: { received?: boolean; read?: boolean } = {},
  ): Promise<DeliveryRow | null> {
    const row = await this.db.updateTable('broadcast_deliveries')
      .set((eb) => ({
        delivered_at: received ? eb.fn.coalesce('delivered_at', now()) : eb.ref('delivered_at'),
        read_at: read ? now() : eb.ref('read_at'),
      }))
      .where('broadcast_msg_id', '=', broadcastMsgId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    return (row as DeliveryRow | undefined) ?? null;
  }

  async refreshMessageTotals(broadcastMsgId: string): Promise<BroadcastMessageRow | null> {
    const row = await this.db.updateTable('broadcast_messages as bm')
      .set((eb) => ({
        total_delivered: this.receiptCount(eb, 'delivered_at'),
        total_read: this.receiptCount(eb, 'read_at'),
      }))
      .where('bm.id', '=', broadcastMsgId)
      .returningAll()
      .executeTakeFirst();
    return (row as BroadcastMessageRow | undefined) ?? null;
  }

  async findDueScheduledMessages(limit = 50): Promise<BroadcastMessageRow[]> {
    return this.db.selectFrom('broadcast_messages').selectAll()
      .where('status', '=', 'scheduled')
      .where('scheduled_at', '<=', now())
      .orderBy('scheduled_at', 'asc')
      .limit(limit)
      .execute() as Promise<BroadcastMessageRow[]>;
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
    // Lo que no viene (null) conserva el valor guardado.
    const row = await this.db.updateTable('broadcast_messages')
      .set((eb) => ({
        status: eb.fn.coalesce(eb.val(status || null), eb.ref('status')),
        sent_at: eb.fn.coalesce(eb.val(sent_at || null), eb.ref('sent_at')),
        total_recipients: eb.fn.coalesce(eb.val(total_recipients ?? null), eb.ref('total_recipients')),
        total_delivered: eb.fn.coalesce(eb.val(total_delivered ?? null), eb.ref('total_delivered')),
        total_read: eb.fn.coalesce(eb.val(total_read ?? null), eb.ref('total_read')),
      }))
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as BroadcastMessageRow;
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
    const row = await this.db.insertInto('broadcast_deliveries')
      .values({ broadcast_msg_id, user_id, conversation_id, delivered_at: now() })
      .onConflict((oc) => oc.columns(['broadcast_msg_id', 'user_id'])
        .doUpdateSet((eb) => ({ conversation_id: eb.ref('excluded.conversation_id') })))
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as DeliveryRow;
  }

  async findUserIdsByDepartment(department: string): Promise<string[]> {
    const rows = await this.db.selectFrom('users').select('id')
      .where('department', '=', department)
      .where('status', '=', 'active')
      .execute();
    return rows.map((r) => r.id);
  }
}

export default new BroadcastRepository();
