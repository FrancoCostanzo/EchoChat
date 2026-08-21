import type { PollResponse } from './poll';
import type { GameResponse } from './game';

/**
 * Contrato de /messages. Fuente de verdad en el backend:
 * backend/src/models/message.model.ts (buildMessageResponse, toMessageResponse)
 * y backend/src/dtos/message.dto.ts (SendMessageRequest, MessageType). Ver la
 * nota de sincronización en types/user.ts.
 */
/** Los valores que un cliente puede mandar al crear un mensaje (sendMessageDto). */
export type MessageType =
  | 'text' | 'media' | 'location' | 'contact' | 'poll'
  | 'forwarded' | 'code' | 'sticker' | 'game';

/**
 * `type` en la respuesta es más ancho que `MessageType`: la columna de la DB
 * (messaging_intranet_schema.sql) también admite 'system' y
 * 'deleted_placeholder', que el servidor genera (p. ej. eventos de llamada) y
 * un cliente nunca envía directamente.
 */
export type ResponseMessageType = MessageType | 'system' | 'deleted_placeholder';

export type MessageBodyFormat = 'plain' | 'markdown' | 'html';

/**
 * Fila de `message_attachments` con los datos de `storage_objects` que trae
 * el JOIN (ver el `json_build_object` en messageRepository). No incluye una
 * URL prefirmada — eso se resuelve aparte, por storageApi.getUrl(id).
 */
export interface MessageAttachment {
  id: string;
  object_type: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  image_width: number | null;
  image_height: number | null;
  duration_ms: number | null;
}

/**
 * Mención resuelta por el backend y guardada en `metadata.mentions`
 * (backend/src/utils/mentions.util.ts). `offset`/`length` son sobre el body
 * crudo, antes de renderizar el markdown.
 */
export interface MessageMention {
  user_id: string;
  /** Texto de la mención sin la arroba ("María García" o "mgarcia"). */
  label: string;
  offset: number;
  length: number;
}

export interface MessageReaction {
  emoji: string;
  /** COUNT() agregado en SQL. */
  count: number;
  user_ids: string[];
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  type: ResponseMessageType;
  body: string | null;
  body_format: MessageBodyFormat | null;
  reply_to_id: string | null;
  reply_to_body: string | null;
  reply_to_type: string | null;
  reply_to_sender: string | null;
  thread_id: string | null;
  thread_count: number;
  forwarded_from_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  link_preview: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
  // Datos del emisor, presentes cuando la fila viene de un JOIN con users.
  sender_username?: string | null;
  sender_display_name?: string | null;
  sender_avatar_key?: string | null;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  // Acuses de recibo: enviado → entregado → leído.
  delivered_count: number;
  read_count: number;
  // Guardado/marcado por el usuario que consulta (cuando la query lo trae).
  is_saved: boolean;
  saved_note: string | null;
  // Los cuelga messageService._attachPolls/_attachGames según el `type`, no
  // buildMessageResponse — por eso son opcionales acá también.
  poll?: PollResponse | null;
  game?: GameResponse | null;
}

export interface MessageThread {
  root: MessageResponse;
  replies: MessageResponse[];
}

export interface SavedMessageResponse extends MessageResponse {
  saved_at: string | null;
  conversation_name: string | null;
  conversation_type: string | null;
}

export interface DraftResponse {
  conversation_id: string;
  body: string | null;
  reply_to_id: string | null;
  /** jsonb sin forma fija del lado del backend tampoco — se deja sin tipar. */
  pending_attachments: unknown[];
  updated_at: string | null;
}

export interface SendMessageRequest {
  conversation_id: string;
  type?: MessageType;
  /** Obligatorio para 'text' y 'code'; opcional en el resto. */
  body?: string | null;
  body_format?: MessageBodyFormat;
  reply_to_id?: string | null;
  thread_id?: string | null;
  forwarded_from_id?: string | null;
  attachment_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateMessageRequest {
  body: string;
  body_format?: MessageBodyFormat;
}

export interface ReactionRequest {
  emoji: string;
}

export interface SaveMessageRequest {
  note?: string | null;
}

export interface DraftRequest {
  body?: string | null;
  reply_to_id?: string | null;
  pending_attachments?: Record<string, unknown>[];
}

export interface ForwardRequest {
  conversation_ids: string[];
}

export interface PaginationRequest {
  cursor?: string | null;
  limit?: number;
  direction?: 'before' | 'after';
}
