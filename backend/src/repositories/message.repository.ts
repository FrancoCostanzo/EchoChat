import BaseRepository from './base.repository';
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

/**
 * Fragmento SELECT que marca si el mensaje está guardado por quien consulta.
 * Empuja el id del viewer en `params`, así que el orden de llamada importa: los
 * placeholders que se agreguen después tienen que contar con ese parámetro.
 */
function savedMessageSelect(viewerUserId: string | undefined | null, params: any[]): string {
  if (!viewerUserId) {
    return 'FALSE AS is_saved, NULL::text AS saved_note';
  }
  const idx = params.length + 1;
  params.push(viewerUserId);
  return `(EXISTS (
    SELECT 1 FROM saved_messages sm
    WHERE sm.message_id = m.id AND sm.user_id = $${idx}
  )) AS is_saved,
  (SELECT sm.note FROM saved_messages sm
   WHERE sm.message_id = m.id AND sm.user_id = $${idx}
   LIMIT 1) AS saved_note`;
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
    await this.query('DELETE FROM message_search_tokens WHERE message_id = $1', [messageId]);
    const tokens = searchTokens(plainBody);
    if (tokens.length === 0) return;
    await this.query(
      `INSERT INTO message_search_tokens (message_id, token)
       SELECT $1, t FROM unnest($2::text[]) AS t
       ON CONFLICT (message_id, token) DO NOTHING`,
      [messageId, tokens]
    );
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
    const { rows } = await this.query(
      `INSERT INTO messages (conversation_id, sender_id, type, body, body_format, reply_to_id, thread_id, forwarded_from_id, forwarded_from_conv, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [conversation_id, sender_id, type || 'text', encrypt(plainBody), body_format || 'plain',
       reply_to_id || null, thread_id || null, forwarded_from_id || null, forwarded_from_conv || null, metadata || {}]
    );
    await this._setSearchTokens(rows[0].id, plainBody);
    return decryptRow(rows[0]);
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
    let condition = 'm.conversation_id = $1 AND m.thread_id IS NULL';
    const params: any[] = [conversationId];

    if (cursor) {
      const op = direction === 'before' ? '<' : '>';
      const cursorMsg = await this.findById(cursor);
      if (cursorMsg) {
        condition += ` AND m.sent_at ${op} $${params.length + 1}`;
        params.push(cursorMsg.sent_at);
      }
    }

    const savedSql = savedMessageSelect(viewerUserId, params);
    params.push(limit);
    const order = direction === 'before' ? 'DESC' : 'ASC';

    const { rows } = await this.query(
      `SELECT m.*,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_object_key AS sender_avatar_key,
              rm.body AS reply_to_body,
              rm.type AS reply_to_type,
              ru.display_name AS reply_to_sender,
              COALESCE(
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
              ) AS attachments,
              -- Receipt aggregation: count of delivered and read per message
              (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.delivered_at IS NOT NULL) AS delivered_count,
              (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.read_at IS NOT NULL) AS read_count,
              (SELECT COUNT(*) FROM messages tm WHERE tm.thread_id = m.id AND tm.is_deleted = FALSE)::int AS thread_count,
              -- Reactions aggregation
              COALESCE(
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
              ) AS reactions,
              ${savedSql}
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       LEFT JOIN message_attachments ma ON ma.message_id = m.id
       LEFT JOIN storage_objects so ON so.id = ma.object_id
       WHERE ${condition}
       GROUP BY m.id, u.username, u.display_name, u.avatar_object_key, rm.body, rm.type, ru.display_name
       ORDER BY m.sent_at ${order}
       LIMIT $${params.length}`,
      params
    );

    rows.forEach((r) => decryptRow(r));
    return direction === 'before' ? rows.reverse() : rows;
  }

  async findWithAttachments(messageId: string, viewerUserId?: string): Promise<MessageRow | null> {
    const params: any[] = [messageId];
    const savedSql = savedMessageSelect(viewerUserId, params);
    const { rows } = await this.query(
      `SELECT m.*,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_object_key AS sender_avatar_key,
              rm.body AS reply_to_body,
              rm.type AS reply_to_type,
              ru.display_name AS reply_to_sender,
              COALESCE(
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
              ) AS attachments,
              (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.delivered_at IS NOT NULL) AS delivered_count,
              (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.read_at IS NOT NULL) AS read_count,
              (SELECT COUNT(*) FROM messages tm WHERE tm.thread_id = m.id AND tm.is_deleted = FALSE)::int AS thread_count,
              COALESCE(
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
              ) AS reactions,
              ${savedSql}
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       LEFT JOIN message_attachments ma ON ma.message_id = m.id
       LEFT JOIN storage_objects so ON so.id = ma.object_id
       WHERE m.id = $1
       GROUP BY m.id, u.username, u.display_name, u.avatar_object_key, rm.body, rm.type, ru.display_name`,
      params
    );
    return decryptRow(rows[0]) || null;
  }

  // All replies of a thread (oldest first), with the same enrichment as the
  // conversation timeline so the thread panel can reuse the message renderer.
  async findThreadReplies(
    threadId: string,
    { limit = 200, viewerUserId }: { limit?: number; viewerUserId?: string } = {},
  ): Promise<MessageRow[]> {
    const params: any[] = [threadId];
    const savedSql = savedMessageSelect(viewerUserId, params);
    params.push(limit);
    const { rows } = await this.query(
      `SELECT m.*,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_object_key AS sender_avatar_key,
              COALESCE(
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
              ) AS attachments,
              COALESCE(
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
              ) AS reactions,
              ${savedSql}
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN message_attachments ma ON ma.message_id = m.id
       LEFT JOIN storage_objects so ON so.id = ma.object_id
       WHERE m.thread_id = $1
       GROUP BY m.id, u.username, u.display_name, u.avatar_object_key
       ORDER BY m.sent_at ASC
       LIMIT $${params.length}`,
      params
    );
    rows.forEach((r) => decryptRow(r));
    return rows;
  }

  async countThreadReplies(threadId: string): Promise<number> {
    const { rows } = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM messages WHERE thread_id = $1 AND is_deleted = FALSE`,
      [threadId]
    );
    return rows[0]?.count ?? 0;
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
      await this.query(
        `INSERT INTO message_edits (message_id, body_before, edited_by) VALUES ($1, $2, $3)`,
        [id, encrypt(original.body), editedBy]
      );
    }

    // `metadata` sólo se pisa si el service lo recalculó (menciones); si no,
    // la fila conserva la que tenía (idioma de un bloque de código, sticker…).
    const { rows } = metadata === undefined
      ? await this.query(
          `UPDATE messages SET body = $1, body_format = $2, is_edited = TRUE, edited_at = NOW()
           WHERE id = $3 RETURNING *`,
          [encrypt(body || null), bodyFormat || 'plain', id]
        )
      : await this.query(
          `UPDATE messages SET body = $1, body_format = $2, metadata = $3, is_edited = TRUE, edited_at = NOW()
           WHERE id = $4 RETURNING *`,
          [encrypt(body || null), bodyFormat || 'plain', metadata, id]
        );
    await this._setSearchTokens(id, body || null);
    return decryptRow(rows[0]);
  }

  async softDelete(id: string, deletedBy: string): Promise<MessageRow> {
    const { rows } = await this.query(
      `UPDATE messages SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2,
              body = NULL, type = 'deleted_placeholder'
       WHERE id = $1 RETURNING *`,
      [id, deletedBy]
    );
    // El contenido desaparece → quitamos sus tokens del índice de búsqueda.
    await this.query('DELETE FROM message_search_tokens WHERE message_id = $1', [id]);
    return decryptRow(rows[0]);
  }

  // Returns only attachment objects that are NOT shared with another message
  // (e.g. forwarded copies reference the same object_id). Callers use this to
  // physically remove MinIO files without breaking the original message.
  async getAttachmentObjects(messageId: string): Promise<ExclusiveAttachment[]> {
    const { rows } = await this.query<ExclusiveAttachment>(
      `SELECT so.bucket_name, so.object_key, so.thumbnail_bucket, so.thumbnail_key, ma.id AS attachment_id, so.id AS object_id
       FROM message_attachments ma
       JOIN storage_objects so ON so.id = ma.object_id
       WHERE ma.message_id = $1
         AND (SELECT COUNT(*) FROM message_attachments ma2 WHERE ma2.object_id = ma.object_id) = 1`,
      [messageId]
    );
    return rows;
  }

  // Object ids attached to a message (used to clone attachments when forwarding)
  async getAttachmentObjectIds(messageId: string): Promise<string[]> {
    const { rows } = await this.query<{ object_id: string }>(
      `SELECT object_id FROM message_attachments WHERE message_id = $1 ORDER BY sort_order`,
      [messageId]
    );
    return rows.map((r) => r.object_id);
  }

  async deleteAttachments(messageId: string): Promise<void> {
    await this.query(`DELETE FROM message_attachments WHERE message_id = $1`, [messageId]);
    await this.query(
      `DELETE FROM storage_objects WHERE id IN (
         SELECT object_id FROM message_attachments WHERE message_id = $1
       )`,
      [messageId]
    );
  }

  async addAttachment(
    messageId: string,
    objectId: string,
    sortOrder = 0,
    caption: string | null = null,
  ): Promise<Row<'message_attachments'>> {
    const { rows } = await this.query<Row<'message_attachments'>>(
      `INSERT INTO message_attachments (message_id, object_id, sort_order, caption)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [messageId, objectId, sortOrder, caption]
    );
    return rows[0];
  }

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<ReactionToggleResult> {
    const { rows } = await this.query<{ emoji: string }>(
      `SELECT emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
      [messageId, userId]
    );
    const existing = rows[0];
    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji → remove it
        await this.query(
          `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
          [messageId, userId]
        );
        return 'removed';
      }
      // Different emoji → update to new one
      await this.query(
        `UPDATE message_reactions SET emoji = $3 WHERE message_id = $1 AND user_id = $2`,
        [messageId, userId, emoji]
      );
      return 'updated';
    }
    await this.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
      [messageId, userId, emoji]
    );
    return 'added';
  }

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const { rowCount } = await this.query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji]
    );
    return (rowCount ?? 0) > 0;
  }

  async getReactions(messageId: string) {
    const { rows } = await this.query<{ emoji: string; count: string; user_ids: string[] }>(
      `SELECT emoji, COUNT(*) AS count,
              ARRAY_AGG(user_id) AS user_ids
       FROM message_reactions
       WHERE message_id = $1
       GROUP BY emoji`,
      [messageId]
    );
    return rows;
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
      const { rows } = await this.query<Row<'message_receipts'>>(
        `INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (message_id, user_id) DO UPDATE
           SET read_at = NOW(),
               delivered_at = COALESCE(message_receipts.delivered_at, NOW())
         RETURNING *`,
        [messageId, userId]
      );
      return rows[0];
    }
    const { rows } = await this.query<Row<'message_receipts'>>(
      `INSERT INTO message_receipts (message_id, user_id, delivered_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (message_id, user_id) DO UPDATE
         SET delivered_at = COALESCE(message_receipts.delivered_at, NOW())
       RETURNING *`,
      [messageId, userId]
    );
    return rows[0];
  }

  async getReceiptCounts(messageId: string): Promise<ReceiptCounts> {
    const { rows } = await this.query<ReceiptCounts>(
      `SELECT
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered_count,
         COUNT(*) FILTER (WHERE read_at IS NOT NULL) AS read_count
       FROM message_receipts
       WHERE message_id = $1`,
      [messageId]
    );
    return rows[0] || { delivered_count: 0, read_count: 0 };
  }

  // Estado de entrega/lectura por cada destinatario de un mensaje, para la
  // vista "Información del mensaje". Parte de TODOS los miembros activos de la
  // conversación (excepto el emisor) y hace LEFT JOIN con los recibos, de modo
  // que quien todavía no recibió ni leyó aparece con delivered_at/read_at en
  // NULL ("pendiente de entrega") en lugar de desaparecer de la lista.
  async getReceipts(messageId: string): Promise<ReceiptDetail[]> {
    const { rows } = await this.query<ReceiptDetail>(
      `SELECT cm.user_id, mr.delivered_at, mr.read_at,
              u.display_name, u.username, u.avatar_object_key, u.avatar_bucket
       FROM messages m
       JOIN conversation_members cm
         ON cm.conversation_id = m.conversation_id
        AND cm.left_at IS NULL
        AND cm.user_id <> m.sender_id
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN message_receipts mr
         ON mr.message_id = m.id AND mr.user_id = cm.user_id
       WHERE m.id = $1
       ORDER BY mr.read_at DESC NULLS LAST,
                mr.delivered_at DESC NULLS LAST,
                u.display_name ASC`,
      [messageId]
    );
    return rows;
  }

  async getReceiptCountsBatch(messageIds: string[]): Promise<Record<string, ReceiptCounts>> {
    if (!messageIds.length) return {};
    const { rows } = await this.query<{ message_id: string } & ReceiptCounts>(
      `SELECT message_id,
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered_count,
         COUNT(*) FILTER (WHERE read_at IS NOT NULL)::int AS read_count
       FROM message_receipts
       WHERE message_id = ANY($1)
       GROUP BY message_id`,
      [messageIds]
    );
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
    const { rows } = await this.query(
      `SELECT m.*, u.username AS sender_username, u.display_name AS sender_display_name
       FROM messages m
       JOIN message_search_tokens t ON t.message_id = m.id
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
         AND m.is_deleted = FALSE
         AND t.token = ANY($2::text[])
       GROUP BY m.id, u.username, u.display_name
       HAVING COUNT(DISTINCT t.token) = $3
       ORDER BY m.sent_at DESC
       LIMIT $4`,
      [conversationId, tokens, tokens.length, limit]
    );
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
    const { rows } = await this.query<Row<'pinned_messages'>>(
      `INSERT INTO pinned_messages (conversation_id, message_id, pinned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (conversation_id) DO UPDATE
         SET message_id = EXCLUDED.message_id,
             pinned_by = EXCLUDED.pinned_by,
             pinned_at = NOW()
       RETURNING *`,
      [conversationId, messageId, pinnedBy]
    );
    return rows[0];
  }

  async unpinMessage(conversationId: string, messageId: string): Promise<boolean> {
    const { rowCount } = await this.query(
      `DELETE FROM pinned_messages WHERE conversation_id = $1 AND message_id = $2`,
      [conversationId, messageId]
    );
    return (rowCount ?? 0) > 0;
  }

  async getPinnedMessage(conversationId: string): Promise<MessageRow | undefined> {
    const { rows } = await this.query(
      `SELECT m.*, pm.pinned_by, pm.pinned_at,
              u.username AS sender_username, u.display_name AS sender_display_name
       FROM pinned_messages pm
       JOIN messages m ON m.id = pm.message_id
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE pm.conversation_id = $1`,
      [conversationId]
    );
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
    const typeFilter = category === 'media'
      ? `so.object_type IN ('image', 'video')`
      : `so.object_type NOT IN ('image', 'video')`;
    const { rows } = await this.query<ConversationAttachmentRow>(
      `SELECT so.id, so.object_type, so.original_filename, so.mime_type, so.file_size_bytes,
              so.image_width, so.image_height, so.duration_ms,
              m.id AS message_id, m.sent_at
       FROM message_attachments ma
       JOIN storage_objects so ON so.id = ma.object_id
       JOIN messages m ON m.id = ma.message_id
       WHERE m.conversation_id = $1 AND m.is_deleted = FALSE AND ${typeFilter}
       ORDER BY m.sent_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    return rows;
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
    const { rows } = await this.query<ConversationLinkCandidateRow>(
      `SELECT m.id AS message_id, m.sent_at, m.body, u.display_name AS sender_display_name
       FROM messages m
       JOIN message_search_tokens t ON t.message_id = m.id
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
         AND m.is_deleted = FALSE
         AND t.token = ANY($2::text[])
       GROUP BY m.id, m.sent_at, m.body, u.display_name
       ORDER BY m.sent_at DESC
       LIMIT $3`,
      [conversationId, tokens, limit]
    );
    rows.forEach((r) => decryptRow(r));
    return rows;
  }
}

export default new MessageRepository();
