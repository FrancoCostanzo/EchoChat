import { sql, type ExpressionBuilder } from 'kysely';
import BaseRepository from './base.repository';
import { upsert, insertIgnore } from '../config/db/upsert';
import { now, json, bool } from '../config/db/sql';
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

// ── Timeline ──────────────────────────────────────────────────────────────
// Antes cada consulta agregaba adjuntos y reacciones con json_agg (exclusivo de
// PostgreSQL). Ahora son tres consultas simples —mensajes, adjuntos y
// reacciones por lote de ids— que se arman acá, y valen en cualquier motor
// (docs/MULTI_DB.md, etapa 3). La forma de la respuesta es la misma.

/** Adjunto tal como lo devolvía json_build_object (mismas claves, mismo orden). */
interface TimelineAttachment {
  id: string;
  object_type: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number;
  image_width: number | null;
  image_height: number | null;
  duration_ms: number | null;
}

/** Reacción agrupada por emoji. `count` va como texto, igual que antes (COUNT::text). */
interface TimelineReaction {
  emoji: string;
  count: string;
  user_ids: string[];
}

const toNumber = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

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
    await insertIgnore(this.db, 'message_search_tokens', tokens.map((token) => ({ message_id: messageId, token })));
  }

  /**
   * Mensajes con remitente y, opcionalmente, el mensaje al que responden y los
   * contadores (acuses y respuestas en hilo). También si el que consulta lo
   * guardó y su nota. Sin adjuntos ni reacciones: los agrega `enrich()`.
   */
  private timelineQuery(viewerUserId: string | undefined | null, { withReplyAndCounts }: { withReplyAndCounts: boolean }) {
    const base = this.db.selectFrom('messages as m')
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .leftJoin('messages as rm', 'rm.id', 'm.reply_to_id')
      .leftJoin('users as ru', 'ru.id', 'rm.sender_id')
      .selectAll('m')
      .select(['u.username as sender_username', 'u.display_name as sender_display_name', 'u.avatar_object_key as sender_avatar_key']);

    const withExtras = withReplyAndCounts
      ? base.select((eb) => [
        'rm.body as reply_to_body',
        'rm.type as reply_to_type',
        'ru.display_name as reply_to_sender',
        eb.selectFrom('message_receipts as mr').select((s) => s.fn.countAll<string>().as('n'))
          .whereRef('mr.message_id', '=', 'm.id').where('mr.delivered_at', 'is not', null)
          .as('delivered_count'),
        eb.selectFrom('message_receipts as mr').select((s) => s.fn.countAll<string>().as('n'))
          .whereRef('mr.message_id', '=', 'm.id').where('mr.read_at', 'is not', null)
          .as('read_count'),
        eb.selectFrom('messages as tm').select((s) => s.cast<number>(s.fn.countAll(), 'integer').as('n'))
          .whereRef('tm.thread_id', '=', 'm.id').where('tm.is_deleted', '=', false)
          .as('thread_count'),
      ])
      : base;

    if (!viewerUserId) {
      return withExtras.select(() => [bool(false).as('is_saved'), sql<string | null>`NULL`.as('saved_note')]);
    }
    return withExtras.select((eb) => [
      eb.exists(eb.selectFrom('saved_messages as sm').select('sm.message_id')
        .whereRef('sm.message_id', '=', 'm.id').where('sm.user_id', '=', viewerUserId)).as('is_saved'),
      eb.selectFrom('saved_messages as sm').select('sm.note')
        .whereRef('sm.message_id', '=', 'm.id').where('sm.user_id', '=', viewerUserId)
        .limit(1)
        .as('saved_note'),
    ]);
  }

  /** Agrega `attachments` y `reactions` a cada mensaje (dos consultas por lote) y descifra. */
  private async enrich(rows: MessageRow[]): Promise<MessageRow[]> {
    const ids = rows.map((r) => r.id);
    const attachments = new Map<string, TimelineAttachment[]>();
    const reactions = new Map<string, TimelineReaction[]>();

    if (ids.length > 0) {
      const files = await this.db.selectFrom('message_attachments as ma')
        .innerJoin('storage_objects as so', 'so.id', 'ma.object_id')
        .select(['ma.message_id', 'so.id', 'so.object_type', 'so.original_filename', 'so.mime_type',
          'so.file_size_bytes', 'so.image_width', 'so.image_height', 'so.duration_ms'])
        .where('ma.message_id', 'in', ids)
        .orderBy('ma.message_id')
        .orderBy('ma.sort_order')
        .execute();
      for (const f of files) {
        const list = attachments.get(f.message_id) ?? [];
        list.push({
          id: f.id,
          object_type: f.object_type,
          original_filename: f.original_filename,
          mime_type: f.mime_type,
          file_size_bytes: Number(f.file_size_bytes),
          image_width: toNumber(f.image_width),
          image_height: toNumber(f.image_height),
          duration_ms: toNumber(f.duration_ms),
        });
        attachments.set(f.message_id, list);
      }

      const votes = await this.db.selectFrom('message_reactions')
        .select(['message_id', 'emoji', 'user_id'])
        .where('message_id', 'in', ids)
        .orderBy('created_at')
        .execute();
      for (const v of votes) {
        const list = reactions.get(v.message_id) ?? [];
        let group = list.find((g) => g.emoji === v.emoji);
        if (!group) {
          group = { emoji: v.emoji, count: '0', user_ids: [] };
          list.push(group);
        }
        group.user_ids.push(v.user_id);
        group.count = String(group.user_ids.length);
        reactions.set(v.message_id, list);
      }
    }

    for (const row of rows) {
      row.attachments = attachments.get(row.id) ?? [];
      row.reactions = reactions.get(row.id) ?? [];
      decryptRow(row);
    }
    return rows;
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
    let q = this.timelineQuery(viewerUserId, { withReplyAndCounts: true })
      .where('m.conversation_id', '=', conversationId)
      .where('m.thread_id', 'is', null);
    if (cursor) {
      const cursorMsg = await this.findById(cursor);
      if (cursorMsg) q = q.where('m.sent_at', direction === 'before' ? '<' : '>', cursorMsg.sent_at as Date);
    }
    const rows = await q
      .orderBy('m.sent_at', direction === 'before' ? 'desc' : 'asc')
      .limit(limit)
      .execute() as unknown as MessageRow[];
    await this.enrich(rows);
    return direction === 'before' ? rows.reverse() : rows;
  }

  async findWithAttachments(messageId: string, viewerUserId?: string): Promise<MessageRow | null> {
    const row = await this.timelineQuery(viewerUserId, { withReplyAndCounts: true })
      .where('m.id', '=', messageId)
      .executeTakeFirst() as unknown as MessageRow | undefined;
    if (!row) return null;
    return (await this.enrich([row]))[0];
  }

  // All replies of a thread (oldest first), with the same enrichment as the
  // conversation timeline so the thread panel can reuse the message renderer.
  async findThreadReplies(
    threadId: string,
    { limit = 200, viewerUserId }: { limit?: number; viewerUserId?: string } = {},
  ): Promise<MessageRow[]> {
    const rows = await this.timelineQuery(viewerUserId, { withReplyAndCounts: false })
      .where('m.thread_id', '=', threadId)
      .orderBy('m.sent_at', 'asc')
      .limit(limit)
      .execute() as unknown as MessageRow[];
    return this.enrich(rows);
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

  /** Reacciones agrupadas por emoji: { emoji, count (texto), user_ids }. Se agrupan acá (antes ARRAY_AGG). */
  async getReactions(messageId: string): Promise<TimelineReaction[]> {
    const votes = await this.db.selectFrom('message_reactions')
      .select(['emoji', 'user_id'])
      .where('message_id', '=', messageId)
      .orderBy('created_at')
      .execute();
    const groups: TimelineReaction[] = [];
    for (const v of votes) {
      let group = groups.find((g) => g.emoji === v.emoji);
      if (!group) {
        group = { emoji: v.emoji, count: '0', user_ids: [] };
        groups.push(group);
      }
      group.user_ids.push(v.user_id);
      group.count = String(group.user_ids.length);
    }
    return groups;
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
      const row = await upsert(this.db, { table: 'message_receipts', values: { message_id: messageId, user_id: userId, delivered_at: now(), read_at: now() }, conflict: ['message_id', 'user_id'], update: (eb) => ({
          read_at: now(),
          delivered_at: eb.fn.coalesce('message_receipts.delivered_at', now()),
        }), returning: true });
      return row as Row<'message_receipts'>;
    }
    const row = await upsert(this.db, { table: 'message_receipts', values: { message_id: messageId, user_id: userId, delivered_at: now() }, conflict: ['message_id', 'user_id'], update: (eb) => ({
        delivered_at: eb.fn.coalesce('message_receipts.delivered_at', now()),
      }), returning: true });
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
    // Primero los ids que tienen todos los tokens; después los mensajes. Así no
    // hace falta agrupar por m.* (SQL Server no lo admite).
    const rows = await this.db.selectFrom('messages as m')
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .selectAll('m')
      .select(['u.username as sender_username', 'u.display_name as sender_display_name'])
      .where('m.id', 'in', (eb) => eb.selectFrom('message_search_tokens as t')
        .innerJoin('messages as tm', 'tm.id', 't.message_id')
        .select('t.message_id')
        .where('tm.conversation_id', '=', conversationId)
        .where('tm.is_deleted', '=', false)
        .where('t.token', 'in', tokens)
        .groupBy('t.message_id')
        .having((h) => h(h.fn.count('t.token').distinct(), '=', tokens.length)))
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
    const row = await upsert(this.db, { table: 'pinned_messages', values: { conversation_id: conversationId, message_id: messageId, pinned_by: pinnedBy }, conflict: ['conversation_id'], update: {
        message_id: messageId,
        pinned_by: pinnedBy,
        pinned_at: now(),
      }, returning: true });
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
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .select(['m.id as message_id', 'm.sent_at', 'm.body', 'u.display_name as sender_display_name'])
      .where('m.conversation_id', '=', conversationId)
      .where('m.is_deleted', '=', false)
      .where('m.id', 'in', (eb) => eb.selectFrom('message_search_tokens as t').select('t.message_id').where('t.token', 'in', tokens))
      .orderBy('m.sent_at', 'desc')
      .limit(limit)
      .execute() as unknown as ConversationLinkCandidateRow[];
    rows.forEach((r) => decryptRow(r));
    return rows;
  }
}

export default new MessageRepository();
