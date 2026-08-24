import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ShareSource } from '../main/screenShare';
import type { StoredToken } from '../main/ipc/auth.ipc';
import type { MenuLabels } from '../main/menu';

/**
 * Puente entre el main y el frontend React. El renderer nunca toca
 * `ipcRenderer` directo (ver docs/STYLE_GUIDE.md § IPC).
 *
 * IMPORTANTE: la forma de este objeto está duplicada en
 * `frontend/src/types/electron.ts`, porque el frontend no puede importar
 * tipos desde `desktop/`. Si cambiás algo acá, actualizá allá.
 */

const SERVER_URL_ARG = '--echochat-server-url=';

/**
 * La URL del servidor llega por argv (la inyecta `additionalArguments` al
 * crear el BrowserWindow) en vez de por IPC asíncrono, porque
 * `frontend/src/lib/api.ts` la necesita de forma síncrona para armar cada
 * request. Vacía = todavía no se configuró ningún servidor.
 */
const serverUrl = process.argv
  .find((arg) => arg.startsWith(SERVER_URL_ARG))
  ?.slice(SERVER_URL_ARG.length) ?? '';

/**
 * Suscribe un callback a un canal y devuelve la función para desuscribirse.
 * Se envuelve el evento para no exponerle `IpcRendererEvent` (y con él
 * `sender`) al renderer.
 */
function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => { ipcRenderer.removeListener(channel, listener); };
}

const electronAPI = {
  platform: process.platform,

  // ── Servidor ────────────────────────────────────────────────────────────
  /** URL del servidor configurado, o `''` si falta configurarlo. Síncrono. */
  getServerUrl: (): string => serverUrl,
  /** Prueba una URL sin guardarla — para validar antes de confirmar. */
  testServerUrl: (url: string) => ipcRenderer.invoke('server:test', url),
  /**
   * Guarda la URL y recrea la ventana. La promesa sólo resuelve con `ok: false`:
   * si la URL sirve, el renderer se destruye antes de recibir la respuesta.
   */
  setServerUrl: (url: string) => ipcRenderer.invoke('server:set-url', url),

  // ── Notificaciones y no leídos ──────────────────────────────────────────
  showNotification: (options: { title: string; body: string; conversationId?: string }) =>
    ipcRenderer.send('notification:show', options),
  /** `description` es lo que leen los lectores de pantalla en Windows. */
  setBadgeCount: (count: number, description: string) =>
    ipcRenderer.send('badge:set', count, description),

  // ── Ventana ─────────────────────────────────────────────────────────────
  isWindowFocused: (): Promise<boolean> => ipcRenderer.invoke('window:is-focused'),
  onWindowFocusChange: (callback: (focused: boolean) => void) =>
    subscribe<boolean>('window:focus-changed', callback),
  onOpenConversation: (callback: (conversationId: string) => void) =>
    subscribe<string>('app:open-conversation', callback),

  // ── Token de sesión ─────────────────────────────────────────────────────
  /**
   * Lectura **síncrona** del JWT cifrado con el llavero del SO. Lo necesita
   * `authStore`, que arma su estado inicial sin await (ver ipc/auth.ipc.ts).
   */
  getAuthToken: (): StoredToken => ipcRenderer.sendSync('auth:get-token'),
  setAuthToken: (token: string | null) => ipcRenderer.send('auth:set-token', token),

  // ── SSO ─────────────────────────────────────────────────────────────────
  /** Abre el login del proveedor en el navegador del sistema. */
  openSsoLogin: (provider: string): Promise<boolean> => ipcRenderer.invoke('sso:open', provider),
  /** Resultado del SSO, que vuelve por el deep link `echochat://`. */
  onSsoResult: (callback: (result: { token?: string; error?: string }) => void) =>
    subscribe<{ token?: string; error?: string }>('sso:result', callback),

  // ── Compartir pantalla ──────────────────────────────────────────────────
  /** El main pide que se muestre el selector de pantalla/ventana. */
  onScreenPickRequest: (callback: (sources: ShareSource[]) => void) =>
    subscribe<ShareSource[]>('screen:pick-request', callback),
  /** Id elegido, o null si el usuario canceló. */
  respondScreenPick: (sourceId: string | null) =>
    ipcRenderer.send('screen:pick-response', sourceId),

  // ── Actualizaciones ─────────────────────────────────────────────────────
  /** Se dispara cuando ya se descargó una versión nueva y falta reiniciar. */
  onUpdateReady: (callback: (version: string) => void) =>
    subscribe<string>('update:ready', callback),
  restartToUpdate: () => ipcRenderer.send('update:restart'),

  // ── Bandeja ─────────────────────────────────────────────────────────────
  /** El main no tiene i18n: las etiquetas llegan ya traducidas del renderer. */
  setTrayLabels: (labels: {
    open: string;
    muteNotifications: string;
    autoLaunch: string;
    changeServer: string;
    quit: string;
    tooltip: string;
  }) => ipcRenderer.send('tray:set-labels', labels),

  // ── Menú de aplicación ──────────────────────────────────────────────────
  /** El main no tiene i18n: las etiquetas llegan ya traducidas del renderer. */
  setMenuLabels: (labels: MenuLabels) => ipcRenderer.send('menu:set-labels', labels),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
