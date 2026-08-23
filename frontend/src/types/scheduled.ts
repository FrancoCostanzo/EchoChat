/**
 * Contrato de /scheduled. Fuente de verdad en el backend:
 * backend/src/models/scheduled.model.ts y backend/src/dtos/scheduled.dto.ts.
 */
export type ScheduledStatus = 'pending' | 'sending' | 'sent' | 'cancelled' | 'failed';

export interface ScheduledMessageResponse {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  body_format: string | null;
  scheduled_at: string;
  status: ScheduledStatus;
  sent_message_id: string | null;
  error: string | null;
  created_at: string | null;
}

export interface ScheduleMessageRequest {
  conversation_id: string;
  body: string;
  body_format?: 'plain' | 'markdown' | 'html';
  /** ISO. El backend rechaza fechas pasadas. */
  scheduled_at: string;
}

export type ReminderStatus = 'pending' | 'done' | 'cancelled';

export interface ReminderResponse {
  id: string;
  message_id: string;
  conversation_id: string;
  remind_at: string;
  note: string | null;
  status: ReminderStatus;
  created_at: string | null;
  /** Contexto que agrega el JOIN, para pintar la lista sin pedir cada mensaje. */
  message_body: string | null;
  message_sender_display_name: string | null;
}

export interface CreateReminderRequest {
  message_id: string;
  remind_at: string;
  note?: string | null;
}
