import type { Row } from '../types/rows';

/** Fila de `message_reminders` más lo que agrega el JOIN del listado. */
export type ReminderRow = Row<'message_reminders'> & {
  message_body?: string | null;
  message_sender_display_name?: string | null;
};

export function toScheduledMessageResponse(row: Row<'scheduled_messages'> | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    body: row.body,
    body_format: row.body_format,
    scheduled_at: row.scheduled_at,
    status: row.status,
    sent_message_id: row.sent_message_id,
    error: row.error,
    created_at: row.created_at,
  };
}

export function toReminderResponse(row: ReminderRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    message_id: row.message_id,
    conversation_id: row.conversation_id,
    remind_at: row.remind_at,
    note: row.note,
    status: row.status,
    created_at: row.created_at,
    // Contexto para pintar la lista sin pedir cada mensaje por separado.
    message_body: row.message_body ?? null,
    message_sender_display_name: row.message_sender_display_name ?? null,
  };
}
