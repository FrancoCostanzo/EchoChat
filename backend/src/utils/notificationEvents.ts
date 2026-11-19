/**
 * Catálogo de eventos que pueden notificar y su comportamiento por defecto.
 *
 * Es la única lista: la usan el despachador (`notificationService.notify`), la
 * validación de preferencias y la respuesta que arma la pantalla de ajustes.
 * El admin puede pisar estos valores con el setting `notification_defaults`.
 */
export const NOTIFICATION_EVENTS = [
  'message.direct',
  'message.group',
  'message.mention',
  'thread.reply',
  'message.reaction',
  'call.incoming',
  'call.missed',
  'broadcast',
  'channel.join_request',
  'reminder',
  'security.alert',
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export interface ChannelFlags {
  in_app: boolean;
  push: boolean;
  email: boolean;
}

export const BUILTIN_EVENT_DEFAULTS: Record<NotificationEvent, ChannelFlags> = {
  'message.direct':       { in_app: true, push: true,  email: false },
  'message.group':        { in_app: true, push: true,  email: false },
  'message.mention':      { in_app: true, push: true,  email: false },
  'thread.reply':         { in_app: true, push: true,  email: false },
  'message.reaction':     { in_app: true, push: false, email: false },
  'call.incoming':        { in_app: true, push: true,  email: false },
  'call.missed':          { in_app: true, push: true,  email: false },
  'broadcast':            { in_app: true, push: true,  email: false },
  'channel.join_request': { in_app: true, push: true,  email: false },
  'reminder':             { in_app: true, push: true,  email: false },
  'security.alert':       { in_app: true, push: true,  email: true },
};

export function isNotificationEvent(value: unknown): value is NotificationEvent {
  return typeof value === 'string' && (NOTIFICATION_EVENTS as readonly string[]).includes(value);
}
