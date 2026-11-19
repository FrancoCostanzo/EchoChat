import { sql, type ExpressionBuilder, type RawBuilder } from 'kysely';
import BaseRepository from './base.repository';
import { now, json } from '../config/db/sql';
import type { DB } from '../types/db';
import { encrypt, decrypt, searchTokens, searchQueryTokens } from '../utils/crypto.util';
import type { Row } from '../types/rows';
import type { MessageRow } from '../models/message.model';

/** Recuentos de acuses de un mensaje. */
export interface ReceiptCounts {
  delivered_count: number;
  read_count: number;
}

/** Estado por destinatario para la vista "Información del mensaje". */
export interface ReceiptDetail {
  user_id: string;
  delivered_at: Date | null;
  read_at: Date | null;
  display_name: string;
  username: string;
  avatar_object_key: string | null;
  avatar_bucket: string | null;
}

/** Objeto adjunto que no está compartido con otro mensaje. */
export interface ExclusiveAttachment {
  bucket_name: string;
  object_key: string;
  thumbnail_bucket: string | null;
  thumbnail_key: string | null;
  attachment_id: string;
  object_id: string;
}

/** Fila de adjunto para las pestañas Multimedia/Archivos del panel de detalle. */
export interface ConversationAttachmentRow {
  id: string;
  object_type: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  image_width: number | null;
  image_height: number | null;
  duration_ms: number | null;
  message_id: string;
  sent_at: Date | string | null;
}

/** Mensaje candidato a contener links (contiene el token "http"/"https"). */
export interface ConversationLinkCandidateRow {
  message_id: string;
  sent_at: Date | string | null;
  sender_display_name: string | null;
  body: string | null;
}

export type ReactionToggleResult = 'added' | 'removed' | 'updated';

// Descifra in-place las columnas con contenido de usuario que puedan venir en una
// fila de mensaje, para que el resto de la app siempre vea texto plano.
// Una sola firma en vez de dos sobrecargas: `T` absorbe el null/undefined que
// traiga el llamador y lo devuelve tal cual, en vez de agregarle un `undefined`
// que la consulta no puede producir.
function decryptRow<T extends Record<string, any> | null | undefined>(row: T): T {
  if (!row) return row;
  // El cast queda confinado a la mutación: la fila se descifra in-place y la
  // firma de afuera conserva el tipo del llamador.
  const r = row as Record<string, any>;
  if ('body' in r) r.body = decrypt(r.body);
  if ('reply_to_body' in r) r.reply_to_body = decrypt(r.reply_to_body);
  if ('saved_note' in r) r.saved_note = decrypt(r.saved_note);
  return row;
}

// ── Fragmentos de las consultas de timeline ───────────────────────────────
// TODO(etapa 3): json_agg/json_build_object y FILTER son de PostgreSQL. Estas
// consultas se parten en tres (mensajes, adjuntos y reacciones por id de
// mensaje) y se arman en la app, que es lo que funciona en cualquier motor.

/** Adjuntos del mensaje como array JSON, en su orden. Requiere el JOIN a ma/so. */
const ATTACHMENTS_AGG = sql`COALESCE(
  json_agg(
    json_build_object(
      'id', so.id,
      'object_type', so.object_type,
      'original_filename', so.original_filename,
      'mime_type', so.mime_type,
      'file_size_bytes', so.file_size_bytes,
      'image_width', so.image_width,
      'image_height', so.image_height,
      'duration_ms', so.duration_ms
    ) ORDER BY ma.sort_order
  ) FILTER (WHERE ma.id IS NOT NULL),
  '[]'
) AS attachments`;

/** Reacciones agrupadas por emoji: [{ emoji, count, user_ids }]. */
const REACTIONS_AGG = sql`COALESCE(
  (SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.cnt, 'user_ids', r.user_ids))
   FROM (
     SELECT emoji,
            COUNT(*)::text AS cnt,
            json_agg(user_id) AS user_ids
     FROM message_reactions
     WHERE message_id = m.id
     GROUP BY emoji
   ) r),
  '[]'
) AS reactions`;

/** Acuses y respuestas en hilo de cada mensaje. */
const COUNTS = sql`(SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.delivered_at IS NOT NULL) AS delivered_count,
  (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.read_at IS NOT NULL) AS read_count,
  (SELECT COUNT(*) FROM messages tm WHERE tm.thread_id = m.id AND tm.is_deleted = FALSE)::int AS thread_count`;

/** Si el mensaje está guardado por quien consulta, y su nota personal. */
function savedSelect(viewerUserId: string | undefined | null) {
  if (!viewerUserId) return sql`FALSE AS is_saved, NULL::text AS saved_note`;
  return sql`(EXISTS (
    SELECT 1 FROM saved_messages sm
    WHERE sm.message_id = m.id AND sm.user_id = ${viewerUserId}
  )) AS is_saved,
  (SELECT sm.note FROM saved_messages sm
   WHERE sm.message_id = m.id AND sm.user_id = ${viewerUserId}
   LIMIT 1) AS saved_note`;
}

/** Mensaje enriquecido completo (timeline principal y un mensaje suelto). */
function enrichedSelect(where: RawBuilder<unknown>, viewerUserId: string | undefined | null) {
  return sql`SELECT m.*,
         u.username AS sender_username,
         u.display_name AS sender_display_name,
         u.avatar_object_key AS sender_avatar_key,
         rm.body AS reply_to_body,
         rm.type AS reply_to_type,
         ru.display_name AS reply_to_sender,
         ${ATTACHMENTS_AGG},
         ${COUNTS},
         ${REACTIONS_AGG},
         ${savedSelect(viewerUserId)}
  FROM messages m
  LEFT JOIN users u ON u.id = m.sender_id
  LEFT JOIN messages rm ON rm.id = m.reply_to_id
  LEFT JOIN users ru ON ru.id = rm.sender_id
  LEFT JOIN message_attachments ma ON ma.message_id = m.id
  LEFT JOIN storage_objects so ON so.id = ma.object_id
  WHERE ${where}
  GROUP BY m.id, u.username, u.display_name, u.avatar_object_key, rm.body, rm.type, ru.display_name`;
}

class MessageRepository extends BaseRepository<MessageRow> {
  constructor() {
    super('messages');
  }

  // findById se usa en todo el service (forward, updateBody, etc.); lo
  // sobreescribimos para que el body salga siempre descifrado.
  async findById(id: string): Promise<MessageRow | null> {
    return decryptRow(await super.findById(id));
  }

  // Reconstruye el índice ciego de búsqueda (HMAC de tokens) de un mensaje a
  // partir de su texto plano. Se llama tras crear/editar.
  async _setSearchTokens(messageId: string, plainBody: string | null): Promise<void> {
    await this.db.deleteFrom('message_search_tokens').where('message_id', '=', messageId).execute();
    const tokens = searchTokens(plainBody);
    if (tokens.length === 0) return;
    await this.db.insertInto('message_search_tokens')
      .values(tokens.map((token) => ({ message_id: messageId, token })))
      .onConflict((oc) => oc.columns(['message_id', 'token']).doNothing())
      .execute();
  }

  async create(
    { conversation_id, sender_id, type, body, body_format, reply_to_id, thread_id,
      forwarded_from_id, forwarded_from_conv, metadata }: {
      conversation_id: string;
      sender_id: string;
      type?: string;
      body?: string | null;
      body_format?: string;
      reply_to_id?: string | null;
      thread_id?: string | null;
      forwarded_from_id?: string | null;
      forwarded_from_conv?: string | null;
      metadata?: unknown;
    },
  ): Promise<MessageRow> {
    const plainBody = body || null;
    const row = await this.db.transaction().execute(async (trx) => {
      const inserted = await trx.insertInto('messages')
      .values({
        conversation_id,
        sender_id,
        type: type || 'text',
        body: encrypt(plainBody),
        body_format: body_format || 'plain',
        reply_to_id: reply_to_id || null,
        thread_id: thread_id || null,
        forwarded_from_id: forwarded_from_id || null,
        forwarded_from_conv: forwarded_from_conv || null,
        metadata: json(metadata || {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
      // La conversación apunta a su último mensaje (antes lo hacía el trigger
      // fn_update_conversation_last_message). updated_at lo pone UpdatedAtPlugin.
      await trx.updateTable('conversations')
        .set({ last_message_at: inserted.sent_at, last_message_id: inserted.id })
        .where('id', '=', conversation_id)
        .execute();
      return inserted;
    }) as unknown as MessageRow;
    await this._setSearchTokens(row.id, plainBody);
    return decryptRow(row);
  }

  async findByConversation(
    conversationId: string,
    { cursor, limit = 50, direction = 'before', viewerUserId }: {
      cursor?: string | null;
      limit?: number;
      direction?: string;
      viewerUserId?: string;
    } = {},
  ): Promise<MessageRow[]> {
    // Thread replies live in their own side panel; the main timeline only
    // shows root messages (with a reply counter aggregated below).
    const conditions = [sql`m.conversation_id = ${conversationId}`, sql`m.thread_id IS NULL`];
    if (cursor) {
      const cursorMsg = await this.findById(cursor);
      if (cursorMsg) {
        conditions.push(direction === 'before'
          ? sql`m.sent_at < ${cursorMsg.sent_at}`
          : sql`m.sent_at > ${cursorMsg.sent_at}`);
      }
    }
    const order = direction === 'before' ? sql`DESC` : sql`ASC`;
    const { rows } = await sql<MessageRow>`${enrichedSelect(sql.join(conditions, sql` AND `), viewerUserId)}
      ORDER BY m.sent_at ${order}
      LIMIT ${limit}`.execute(this.db);

    rows.forEach((r) => decryptRow(r));
    return direction === 'before' ? rows.reverse() : rows;
  }

  async findWithAttachments(messageId: string, viewerUserId?: string): Promise<MessageRow | null> {
    const { rows } = await sql<MessageRow>`${enrichedSelect(sql`m.id = ${messageId}`, viewerUserId)}`.execute(this.db);
    return decryptRow(rows[0]) || null;
  }

  // All replies of a thread (oldest first), with the same enrichment as the
  // conversation timeline so the thread panel can reuse the message renderer.
  async findThreadReplies(
    threadId: string,
    { limit = 200, viewerUserId }: { limit?: number; viewerUserId?: string } = {},
  ): Promise<MessageRow[]> {
    const { rows } = await sql<MessageRow>`SELECT m.*,
             u.username AS sender_username,
             u.display_name AS sender_display_name,
             u.avatar_object_key AS sender_avatar_key,
             ${ATTACHMENTS_AGG},
             ${REACTIONS_AGG},
             ${savedSelect(viewerUserId)}
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN message_attachments ma ON ma.message_id = m.id
      LEFT JOIN storage_objects so ON so.id = ma.object_id
      WHERE m.thread_id = ${threadId}
      GROUP BY m.id, u.username, u.display_name, u.avatar_object_key
      ORDER BY m.sent_at ASC
      LIMIT ${limit}`.execute(this.db);
    rows.forEach((r) => decryptRow(r));
    return rows;
  }

  /** Autor de la raíz + quienes respondieron en el hilo (sin repetir). */
  async getThreadParticipantIds(threadId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('messages').select('sender_id').distinct()
      .where((eb) => eb.or([eb('id', '=', threadId), eb('thread_id', '=', threadId)]))
      .where('is_deleted', '=', false)
      .where('sender_id', 'is not', null)
      .execute();
    return rows.map((r) => r.sender_id as string);
  }

  async countThreadReplies(threadId: string): Promise<number> {
    const row = await this.db.selectFrom('messages')
      .select((eb) => eb.cast<number>(eb.fn.countAll(), 'integer').as('count'))
      .where('thread_id', '=', threadId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();
    return row?.count ?? 0;
  }

  async updateBody(
    id: string,
    body: string | null,
    editedBy: string,
    bodyFormat?: string,
    metadata?: unknown,
  ): Promise<MessageRow> {
    // Save edit history (el body anterior, ya en texto plano vía findById, se
    // vuelve a cifrar antes de guardarlo en el historial).
    const original = await this.findById(id);
    if (original && original.body) {
      await this.db.insertInto('message_edits')
        .values({ message_id: id, body_before: encrypt(original.body) as string, edited_by: editedBy })
        .execute();
    }

    // `metadata` sólo se pisa si el service lo recalculó (menciones); si no,
    // la fila conserva la que tenía (idioma de un bloque de código, sticker…).
    const row = await this.db.updateTable('messages')
      .set({
        body: encrypt(body || null),
        body_format: bodyFormat || 'plain',
        ...(metadata === undefined ? {} : { metadata: json(metadata) }),
        is_edited: true,
        edited_at: now(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    await this._setSearchTokens(id, body || null);
    return decryptRow(row as unknown as MessageRow);
  }

  async softDelete(id: string, deletedBy: string): Promise<MessageRow> {
    const row = await this.db.updateTable('messages')
      .set({ is_deleted: true, deleted_at: now(), deleted_by: deletedBy, body: null, type: 'deleted_placeholder' })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    // El contenido desaparece → quitamos sus tokens del índice de búsqueda.
    await this.db.deleteFrom('message_search_tokens').where('message_id', '=', id).execute();
    return decryptRow(row as unknown as MessageRow);
  }

  // Returns only attachment objects that are NOT shared with another message
  // (e.g. forwarded copies reference the same object_id). Callers use this to
  // physically remove MinIO files without breaking the original message.
  async getAttachmentObjects(messageId: string): Promise<ExclusiveAttachment[]> {
    return this.db.selectFrom('message_attachments as ma')
      .innerJoin('storage_objects as so', 'so.id', 'ma.object_id')
      .select(['so.bucket_name', 'so.object_key', 'so.thumbnail_bucket', 'so.thumbnail_key', 'ma.id as attachment_id', 'so.id as object_id'])
      .where('ma.message_id', '=', messageId)
      .where((eb) => eb(
        eb.selectFrom('message_attachments as ma2').select((s) => s.fn.countAll().as('n')).whereRef('ma2.object_id', '=', 'ma.object_id'),
        '=',
        1,
      ))
      .execute() as Promise<ExclusiveAttachment[]>;
  }

  // Object ids attached to a message (used to clone attachments when forwarding)
  async getAttachmentObjectIds(messageId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('message_attachments').select('object_id')
      .where('message_id', '=', messageId)
      .orderBy('sort_order')
      .execute();
    return rows.map((r) => r.object_id);
  }

  async deleteAttachments(messageId: string): Promise<void> {
    await this.db.deleteFrom('message_attachments').where('message_id', '=', messageId).execute();
    // Mismo orden que antes: al correr, los adjuntos ya no están y la
    // subconsulta no encuentra objetos (ver docs/MULTI_DB.md, hallazgos).
    await this.db.deleteFrom('storage_objects')
      .where('id', 'in', (eb) => eb.selectFrom('message_attachments').select('object_id').where('message_id', '=', messageId))
      .execute();
  }

  async addAttachment(
    messageId: string,
    objectId: string,
    sortOrder = 0,
    caption: string | null = null,
  ): Promise<Row<'message_attachments'>> {
    const row = await this.db.insertInto('message_attachments')
      .values({ message_id: messageId, object_id: objectId, sort_order: sortOrder, caption })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as Row<'message_attachments'>;
  }

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<ReactionToggleResult> {
    const existing = await this.reactionsOf(messageId, userId).select('emoji').executeTakeFirst();
    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji → remove it
        await this.db.deleteFrom('message_reactions')
          .where('message_id', '=', messageId).where('user_id', '=', userId)
          .execute();
        return 'removed';
      }
      // Different emoji → update to new one
      await this.db.updateTable('message_reactions')
        .set({ emoji })
        .where('message_id', '=', messageId).where('user_id', '=', userId)
        .execute();
      return 'updated';
    }
    await this.db.insertInto('message_reactions').values({ message_id: messageId, user_id: userId, emoji }).execute();
    return 'added';
  }

  private reactionsOf(messageId: string, userId: string) {
    return this.db.selectFrom('message_reactions').where('message_id', '=', messageId).where('user_id', '=', userId);
  }

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const result = await this.db.deleteFrom('message_reactions')
      .where('message_id', '=', messageId).where('user_id', '=', userId).where('emoji', '=', emoji)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async getReactions(messageId: string) {
    // TODO(etapa 3): ARRAY_AGG es de PostgreSQL.
    return this.db.selectFrom('message_reactions')
      .select((eb) => [
        'emoji',
        eb.fn.countAll<string>().as('count'),
        sql<string[]>`ARRAY_AGG(user_id)`.as('user_ids'),
      ])
      .where('message_id', '=', messageId)
      .groupBy('emoji')
      .execute();
  }

  async addReceipt(
    messageId: string,
    userId: string,
    type = 'delivered',
  ): Promise<Row<'message_receipts'>> {
    if (type === 'read') {
      // Leer implica haber recibido: fijamos read_at y, si todavía no había
      // marca de entrega, completamos delivered_at en la misma operación para
      // que la "Información del mensaje" muestre ambas horas de forma coherente.
      const row = await this.db.insertInto('message_receipts')
        .values({ message_id: messageId, user_id: userId, delivered_at: now(), read_at: now() })
        .onConflict((oc) => oc.columns(['message_id', 'user_id']).doUpdateSet((eb) => ({
          read_at: now(),
          delivered_at: eb.fn.coalesce('message_receipts.delivered_at', now()),
        })))
        .returningAll()
        .executeTakeFirstOrThrow();
      return row as Row<'message_receipts'>;
    }
    const row = await this.db.insertInto('message_receipts')
      .values({ message_id: messageId, user_id: userId, delivered_at: now() })
      .onConflict((oc) => oc.columns(['message_id', 'user_id']).doUpdateSet((eb) => ({
        delivered_at: eb.fn.coalesce('message_receipts.delivered_at', now()),
      })))
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as Row<'message_receipts'>;
  }

  /** delivered_count / read_count como SUM(CASE), que vale en cualquier motor. */
  private receiptCountColumns(eb: ExpressionBuilder<DB, 'message_receipts'>) {
    const countWhere = (column: 'delivered_at' | 'read_at') => eb.fn.coalesce(
      eb.fn.sum(eb.case().when(column, 'is not', null).then(1).else(0).end()),
      eb.lit(0),
    );
    return {
      delivered: countWhere('delivered_at'),
      read: countWhere('read_at'),
    };
  }

  async getReceiptCounts(messageId: string): Promise<ReceiptCounts> {
    const row = await this.db.selectFrom('message_receipts')
      .select((eb) => {
        const c = this.receiptCountColumns(eb);
        // Como antes, vuelven como string (bigint de COUNT).
        return [eb.cast<number>(c.delivered, 'bigint').as('delivered_count'), eb.cast<number>(c.read, 'bigint').as('read_count')];
      })
      .where('message_id', '=', messageId)
      .executeTakeFirst();
    return row || { delivered_count: 0, read_count: 0 };
  }

  // Estado de entrega/lectura por cada destinatario de un mensaje, para la
  // vista "Información del mensaje". Parte de TODOS los miembros activos de la
  // conversación (excepto el emisor) y hace LEFT JOIN con los recibos, de modo
  // que quien todavía no recibió ni leyó aparece con delivered_at/read_at en
  // NULL ("pendiente de entrega") en lugar de desaparecer de la lista.
  async getReceipts(messageId: string): Promise<ReceiptDetail[]> {
    return this.db.selectFrom('messages as m')
      .innerJoin('conversation_members as cm', (j) => j
        .onRef('cm.conversation_id', '=', 'm.conversation_id')
        .on('cm.left_at', 'is', null)
        .onRef('cm.user_id', '<>', 'm.sender_id'))
      .innerJoin('users as u', 'u.id', 'cm.user_id')
      .leftJoin('message_receipts as mr', (j) => j
        .onRef('mr.message_id', '=', 'm.id')
        .onRef('mr.user_id', '=', 'cm.user_id'))
      .select(['cm.user_id', 'mr.delivered_at', 'mr.read_at', 'u.display_name', 'u.username', 'u.avatar_object_key', 'u.avatar_bucket'])
      .where('m.id', '=', messageId)
      // TODO(etapa 3): NULLS LAST no existe en SQL Server.
      .orderBy('mr.read_at', (ob) => ob.desc().nullsLast())
      .orderBy('mr.delivered_at', (ob) => ob.desc().nullsLast())
      .orderBy('u.display_name', 'asc')
      .execute() as Promise<ReceiptDetail[]>;
  }

  async getReceiptCountsBatch(messageIds: string[]): Promise<Record<string, ReceiptCounts>> {
    if (!messageIds.length) return {};
    const rows = await this.db.selectFrom('message_receipts')
      .select((eb) => {
        const c = this.receiptCountColumns(eb);
        return ['message_id', eb.cast<number>(c.delivered, 'integer').as('delivered_count'), eb.cast<number>(c.read, 'integer').as('read_count')];
      })
      .where('message_id', 'in', messageIds)
      .groupBy('message_id')
      .execute();
    const map: Record<string, ReceiptCounts> = {};
    for (const r of rows) {
      map[r.message_id] = { delivered_count: r.delivered_count, read_count: r.read_count };
    }
    return map;
  }

  async search(conversationId: string, term: string, limit = 20): Promise<MessageRow[]> {
    // Búsqueda server-side sobre el índice ciego: el término se tokeniza y se
    // convierte a HMAC igual que al indexar. Semántica AND (deben aparecer todos
    // los tokens). Sin ranking ni stemming (trade-off del cifrado en reposo).
    const tokens = searchQueryTokens(term);
    if (tokens.length === 0) return [];
    const rows = await this.db.selectFrom('messages as m')
      .innerJoin('message_search_tokens as t', 't.message_id', 'm.id')
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .selectAll('m')
      .select(['u.username as sender_username', 'u.display_name as sender_display_name'])
      .where('m.conversation_id', '=', conversationId)
      .where('m.is_deleted', '=', false)
      .where('t.token', 'in', tokens)
      .groupBy(['m.id', 'u.username', 'u.display_name'])
      .having((h) => h(h.fn.count('t.token').distinct(), '=', tokens.length))
      .orderBy('m.sent_at', 'desc')
      .limit(limit)
      .execute() as unknown as MessageRow[];
    rows.forEach((r) => decryptRow(r));
    return rows;
  }

  // Un chat sólo puede tener un mensaje fijado a la vez: fijar uno nuevo
  // reemplaza atómicamente al que hubiera antes (UPSERT sobre el índice único
  // sólo por conversation_id — un DELETE + INSERT separados en el mismo
  // statement puede chocar contra ese mismo índice, según el orden en que
  // Postgres evalúe la sentencia).
  async pinMessage(
    conversationId: string,
    messageId: string,
    pinnedBy: string,
  ): Promise<Row<'pinned_messages'> | undefined> {
    const row = await this.db.insertInto('pinned_messages')
      .values({ conversation_id: conversationId, message_id: messageId, pinned_by: pinnedBy })
      .onConflict((oc) => oc.column('conversation_id').doUpdateSet((eb) => ({
        message_id: eb.ref('excluded.message_id'),
        pinned_by: eb.ref('excluded.pinned_by'),
        pinned_at: now(),
      })))
      .returningAll()
      .executeTakeFirst();
    return row as Row<'pinned_messages'> | undefined;
  }

  async unpinMessage(conversationId: string, messageId: string): Promise<boolean> {
    const result = await this.db.deleteFrom('pinned_messages')
      .where('conversation_id', '=', conversationId).where('message_id', '=', messageId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async getPinnedMessage(conversationId: string): Promise<MessageRow | undefined> {
    const rows = await this.db.selectFrom('pinned_messages as pm')
      .innerJoin('messages as m', 'm.id', 'pm.message_id')
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .selectAll('m')
      .select(['pm.pinned_by', 'pm.pinned_at', 'u.username as sender_username', 'u.display_name as sender_display_name'])
      .where('pm.conversation_id', '=', conversationId)
      .execute() as unknown as MessageRow[];
    rows.forEach((r) => decryptRow(r));
    return rows[0];
  }

  // Pestaña Multimedia (category='media', imágenes/video) o Archivos
  // (category='files', el resto) del panel de detalle de conversación.
  async getConversationAttachments(
    conversationId: string,
    category: 'media' | 'files',
    limit: number,
    offset: number,
  ): Promise<ConversationAttachmentRow[]> {
    return this.db.selectFrom('message_attachments as ma')
      .innerJoin('storage_objects as so', 'so.id', 'ma.object_id')
      .innerJoin('messages as m', 'm.id', 'ma.message_id')
      .select([
        'so.id', 'so.object_type', 'so.original_filename', 'so.mime_type', 'so.file_size_bytes',
        'so.image_width', 'so.image_height', 'so.duration_ms',
        'm.id as message_id', 'm.sent_at',
      ])
      .where('m.conversation_id', '=', conversationId)
      .where('m.is_deleted', '=', false)
      .where('so.object_type', category === 'media' ? 'in' : 'not in', ['image', 'video'])
      .orderBy('m.sent_at', 'desc')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<ConversationAttachmentRow[]>;
  }

  // Mensajes candidatos a contener un link para la pestaña Links del panel de
  // detalle. El body está cifrado en reposo, así que no se puede filtrar por
  // regex en SQL: se usa el índice ciego de búsqueda (mismo mecanismo que
  // `search()`) para acotar a mensajes cuyo token "http"/"https" está
  // indexado, y recién ahí se descifra. La extracción exacta de URLs (regex)
  // y la paginación final ocurren en el service sobre este set ya acotado.
  async getConversationLinkCandidates(conversationId: string, limit: number): Promise<ConversationLinkCandidateRow[]> {
    const tokens = [...new Set([...searchQueryTokens('http'), ...searchQueryTokens('https')])];
    if (tokens.length === 0) return [];
    const rows = await this.db.selectFrom('messages as m')
      .innerJoin('message_search_tokens as t', 't.message_id', 'm.id')
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .select(['m.id as message_id', 'm.sent_at', 'm.body', 'u.display_name as sender_display_name'])
      .where('m.conversation_id', '=', conversationId)
      .where('m.is_deleted', '=', false)
      .where('t.token', 'in', tokens)
      .groupBy(['m.id', 'm.sent_at', 'm.body', 'u.display_name'])
      .orderBy('m.sent_at', 'desc')
      .limit(limit)
      .execute() as unknown as ConversationLinkCandidateRow[];
    rows.forEach((r) => decryptRow(r));
    return rows;
  }
}

export default new MessageRepository();
