/**
 * Contrato de /broadcasts. A diferencia de los demás dominios, el backend no
 * tiene un backend/src/models/broadcast.model.ts que formalice la forma de
 * `data` en la respuesta — se arma inline en broadcast.service.ts /
 * broadcast.repository.ts. Las respuestas de abajo se reconstruyeron leyendo
 * esas dos fuentes (y backend/src/types/db.d.ts para las columnas crudas).
 * Ver la nota de sincronización en types/user.ts.
 */
export interface CreateBroadcastListRequest {
  name: string;
  description?: string | null;
  recipient_ids: string[];
}

export interface SendBroadcastRequest {
  body: string;
  type?: 'text' | 'media' | 'template';
  object_id?: string | null;
  scheduled_at?: string | null;
}

/** Se agrega por lista de ids o por departamento entero (al menos uno). */
export interface AddBroadcastRecipientsRequest {
  recipient_ids?: string[];
  department?: string | null;
}

/** GET /broadcasts (findByOwner) y create(). Fuente: broadcast.repository.ts. */
export interface BroadcastListResponse {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  /** Solo presente en el listado (findByOwner hace el COUNT). */
  recipient_count?: number;
  /** Solo presente en el detalle (getListById los resuelve aparte). */
  recipients?: BroadcastRecipient[];
}

/** Fila de broadcast_recipients + los datos del usuario que trae el JOIN. */
export interface BroadcastRecipient {
  broadcast_list_id: string;
  user_id: string;
  added_by: string | null;
  added_at: string | null;
  username: string;
  display_name: string;
  department: string | null;
  avatar_bucket: string | null;
  avatar_object_key: string | null;
  presence: string | null;
  /** Resuelta por broadcast.service.ts cuando hay avatar_object_key. */
  avatar_url?: string;
}

/** GET /broadcasts/:id/messages. Fuente: broadcastRepository.findMessagesByListId. */
export interface BroadcastMessageResponse {
  id: string;
  broadcast_list_id: string;
  sender_id: string;
  body: string | null;
  type: string | null;
  object_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  status: string | null;
  total_recipients: number | null;
  total_delivered: number | null;
  total_read: number | null;
  created_at: string | null;
  sender_username: string;
  sender_display_name: string;
  sender_avatar_bucket: string | null;
  sender_avatar_object_key: string | null;
  /** Cuenta en vivo de acuses (no el contador desnormalizado). */
  total_sent: number;
  /** Resuelta por broadcast.service.ts cuando hay sender_avatar_object_key. */
  sender_avatar_url?: string;
}

/** GET /broadcasts/:id/messages/:msgId/deliveries. Fuente: broadcastRepository.getDeliveries. */
export interface BroadcastDeliveryDetail {
  broadcast_msg_id: string;
  user_id: string;
  conversation_id: string | null;
  /** Momento del fan-out en el servidor (creó el DM). */
  sent_to_chat_at: string | null;
  legacy_read_at: string | null;
  username: string;
  display_name: string;
  department: string | null;
  avatar_bucket: string | null;
  avatar_object_key: string | null;
  presence: string | null;
  message_id: string | null;
  /** Acuse real del cliente destinatario (message_receipts). */
  received_at: string | null;
  read_at: string | null;
  /** Resuelta por broadcast.service.ts cuando hay avatar_object_key. */
  avatar_url?: string;
}
