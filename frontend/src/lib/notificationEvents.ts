import type { NotificationEvent } from '@/types/notification';

/**
 * Eventos que notifican, agrupados como se muestran en Ajustes y en el panel
 * del admin. Debe tener los mismos eventos que
 * backend/src/utils/notificationEvents.ts.
 */
export const NOTIFICATION_EVENT_GROUPS: { id: string; events: NotificationEvent[] }[] = [
  { id: 'messages', events: ['message.direct', 'message.group', 'message.mention', 'thread.reply', 'message.reaction'] },
  { id: 'calls', events: ['call.incoming', 'call.missed'] },
  { id: 'other', events: ['broadcast', 'channel.join_request', 'reminder', 'security.alert'] },
];

export const NOTIFICATION_EVENTS: NotificationEvent[] = NOTIFICATION_EVENT_GROUPS.flatMap((g) => g.events);
