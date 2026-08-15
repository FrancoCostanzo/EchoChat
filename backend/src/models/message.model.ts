import type { Row } from '../types/rows';
import type { PollResponse } from './poll.model';
import type { GameResponse } from './game.model';

/**
 * Fila de mensaje más las columnas que agregan los JOINs de `messageRepository`
 * (datos del emisor, adjuntos, reacciones, acuses). Declararlas documenta qué
 * tiene que traer cada consulta.
 */
export type MessageRow = Row<'messages'> & {
  reply_to_body?: string | null;
  reply_to_type?: string | null;
  reply_to_sender?: string | null;
  /** COUNT(): pg devuelve los bigint como string. */
  thread_count?: string | null;
  sender_username?: string | null;
  sender_display_name?: string | null;
  sender_avatar_key?: string | null;
  attachments?: unknown[] | null;
  reactions?: unknown[] | null;
  delivered_count?: string | null;
  read_count?: string | null;
  /** Puede llegar como booleano o como el 't' de Postgres según la consulta. */
  is_saved?: boolean | string | null;
  saved_note?: string | null;
};

export type SavedMessageRow = MessageRow & {
  saved_at?: Date | null;
  conversation_name?: string | null;
  conversation_type?: string | null;
};

function buildMessageResponse(row: MessageRow) {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    type: row.type,
    body: row.body,
    body_format: row.body_format,
    reply_to_id: row.reply_to_id,
    reply_to_body: row.reply_to_body ?? null,
    reply_to_type: row.reply_to_type ?? null,
    reply_to_sender: row.reply_to_sender ?? null,
    thread_id: row.thread_id,
    thread_count: parseInt(row.thread_count ?? '', 10) || 0,
    forwarded_from_id: row.forwarded_from_id,
    is_edited: row.is_edited,
    edited_at: row.edited_at,
    is_deleted: row.is_deleted,
    link_preview: row.link_preview,
    metadata: row.metadata,
    sent_at: row.sent_at,
    // Optionally joined sender info
    sender_username: row.sender_username,
    sender_display_name: row.sender_display_name,
    sender_avatar_key: row.sender_avatar_key,
    // Attachments array if joined
    attachments: row.attachments ?? [],
    // Reactions summary if joined
    reactions: row.reactions ?? [],
    // Read receipt counts (sent → delivered → read)
    delivered_count: parseInt(row.delivered_count ?? '', 10) || 0,
    read_count: parseInt(row.read_count ?? '', 10) || 0,
    // Saved/bookmarked by the viewing user (when joined in the query)
    is_saved: row.is_saved === true || row.is_saved === 't',
    saved_note: row.saved_note ?? null,
  };
}

/**
 * Contrato de la API para un mensaje.
 *
 * `poll` y `game` no los arma esta función: los cuelgan después
 * `messageService._attachPolls` / `_attachGames` según el tipo de mensaje. Que
 * sean opcionales acá es lo que hace que esos servicios sean tipables — y
 * documenta una parte del contrato que hasta ahora sólo se descubría leyendo
 * el código.
 */
export type MessageResponse = ReturnType<typeof buildMessageResponse> & {
  poll?: PollResponse | null;
  game?: GameResponse | null;
};

export function toMessageResponse(row: MessageRow | null | undefined): MessageResponse | null {
  if (!row) return null;
  return buildMessageResponse(row);
}

export function toSavedMessageResponse(row: SavedMessageRow | null | undefined) {
  if (!row) return null;
  return {
    ...toMessageResponse(row)!,
    saved_note: row.saved_note ?? null,
    saved_at: row.saved_at,
    conversation_name: row.conversation_name ?? null,
    conversation_type: row.conversation_type ?? null,
  };
}

/**
 * `pending_attachments` es una columna `jsonb`, así que el tipo generado la deja
 * como Json (string, número, objeto…). El código siempre guarda un array, y por
 * eso se reemplaza en vez de intersecarse: una intersección exigiría que fuera
 * las dos cosas a la vez.
 */
export type DraftRow = Omit<Row<'drafts'>, 'pending_attachments'> & {
  pending_attachments?: unknown[] | null;
};

export function toDraftResponse(row: DraftRow | null | undefined) {
  if (!row) return null;
  return {
    conversation_id: row.conversation_id,
    body: row.body,
    reply_to_id: row.reply_to_id,
    pending_attachments: row.pending_attachments ?? [],
    updated_at: row.updated_at,
  };
}

export type SavedMessageResponse = NonNullable<ReturnType<typeof toSavedMessageResponse>>;
export type DraftResponse = NonNullable<ReturnType<typeof toDraftResponse>>;
