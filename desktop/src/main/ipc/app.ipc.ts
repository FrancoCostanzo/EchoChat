import { ipcMain } from 'electron';
import { setUnreadBadge } from '../badge';
import { setTrayLabels, type TrayLabels } from '../tray';
import { getMainWindow } from '../window';

const TRAY_LABEL_KEYS: (keyof TrayLabels)[] = [
  'open',
  'muteNotifications',
  'autoLaunch',
  'changeServer',
  'quit',
  'tooltip',
];

/** Valida lo que llega del renderer: nunca es una fuente confiable. */
function parseTrayLabels(raw: unknown): TrayLabels | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const record = raw as Record<string, unknown>;
  if (!TRAY_LABEL_KEYS.every((key) => typeof record[key] === 'string' && record[key])) return null;

  return Object.fromEntries(
    TRAY_LABEL_KEYS.map((key) => [key, (record[key] as string).slice(0, 80)]),
  ) as unknown as TrayLabels;
}

export function registerAppIpc(): void {
  ipcMain.handle('window:is-focused', () => getMainWindow()?.isFocused() ?? false);

  ipcMain.on('badge:set', (_event, count: unknown, description: unknown) => {
    setUnreadBadge(
      getMainWindow(),
      typeof count === 'number' ? count : 0,
      typeof description === 'string' ? description : '',
    );

    // Volver a leer los mensajes apaga el parpadeo de la barra de tareas.
    if (count === 0) getMainWindow()?.flashFrame(false);
  });

  ipcMain.on('tray:set-labels', (_event, raw: unknown) => {
    const labels = parseTrayLabels(raw);
    if (!labels) {
      console.warn('[ipc] tray:set-labels recibió etiquetas inválidas, se ignoran');
      return;
    }
    setTrayLabels(labels);
  });
}
