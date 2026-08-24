import { ipcMain, Notification } from 'electron';
import { notificationsMuted } from '../tray';
import { getMainWindow, showMainWindow } from '../window';

/** Recortes defensivos: el SO trunca igual, y evita que un mensaje enorme infle la notificación. */
const MAX_TITLE = 120;
const MAX_BODY = 300;

interface NotificationPayload {
  title: string;
  body: string;
  /** Para abrir la conversación al hacer click. */
  conversationId?: string;
}

/** Valida lo que llega del renderer: nunca es una fuente confiable. */
function parsePayload(raw: unknown): NotificationPayload | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const { title, body, conversationId } = raw as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim()) return null;
  if (typeof body !== 'string') return null;

  return {
    title: title.slice(0, MAX_TITLE),
    body: body.slice(0, MAX_BODY),
    conversationId: typeof conversationId === 'string' ? conversationId : undefined,
  };
}

export function registerNotificationIpc(): void {
  ipcMain.on('notification:show', (_event, raw: unknown) => {
    if (!Notification.isSupported() || notificationsMuted()) return;

    const payload = parsePayload(raw);
    if (!payload) return;

    const notification = new Notification({ title: payload.title, body: payload.body });

    notification.on('click', () => {
      const win = showMainWindow();
      if (payload.conversationId) {
        win.webContents.send('app:open-conversation', payload.conversationId);
      }
    });

    notification.show();

    // En Windows la notificación es efímera; el parpadeo en la barra de tareas
    // es lo que queda si el usuario no estaba mirando.
    const win = getMainWindow();
    if (process.platform === 'win32' && win && !win.isFocused()) win.flashFrame(true);
  });
}
