/**
 * Contrato del puente que expone el preload de Electron en `window.electronAPI`.
 *
 * Está duplicado a mano desde `desktop/src/preload/index.ts` porque el frontend
 * no puede importar tipos desde `desktop/` (son paquetes npm separados, y la
 * web se buildea sin el módulo de escritorio). Si cambiás uno, cambiá el otro.
 *
 * `electronAPI` es opcional en todos lados: en la web no existe.
 */

/** Motivos por los que una URL de servidor puede rechazarse. */
export type ServerProbeError = 'invalid-url' | 'unreachable' | 'not-echochat' | 'degraded';

export interface ServerProbeResult {
  ok: boolean;
  /** La URL ya normalizada, sólo cuando `ok` es true. */
  url?: string;
  error?: ServerProbeError;
}

export interface NotificationOptions {
  title: string;
  body: string;
  /** Si viene, hacer click en la notificación abre esa conversación. */
  conversationId?: string;
}

/** Etiquetas del menú de bandeja, que el renderer manda ya traducidas. */
export interface TrayLabels {
  open: string;
  muteNotifications: string;
  autoLaunch: string;
  changeServer: string;
  quit: string;
  tooltip: string;
}

/** Etiquetas del menú de aplicación (Edit + macOS app/window menu), ya traducidas. */
export interface MenuLabels {
  edit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  selectAll: string;
  hide: string;
  hideOthers: string;
  unhide: string;
  quit: string;
  window: string;
  minimize: string;
  close: string;
}

/** Lectura del JWT guardado con el llavero del SO. */
export interface StoredToken {
  /** false = el SO no ofrece cifrado; hay que seguir con localStorage. */
  available: boolean;
  token: string | null;
}

/** Resultado del SSO, que llega por el deep link `echochat://`. */
export interface SsoResult {
  token?: string;
  error?: string;
}

/** Una pantalla o ventana que se puede compartir en una llamada. */
export interface ShareSource {
  id: string;
  name: string;
  /** PNG en data: URI. */
  thumbnail: string;
  kind: 'screen' | 'window';
}

export interface ElectronAPI {
  /** `process.platform` del main. Acotado a los tres SO para los que se buildea. */
  platform: 'win32' | 'darwin' | 'linux';

  getServerUrl: () => string;
  testServerUrl: (url: string) => Promise<ServerProbeResult>;
  /**
   * Guarda la URL y recrea la ventana. Si la URL sirve, el renderer se destruye
   * antes de que la promesa resuelva: en la práctica sólo devuelve errores.
   */
  setServerUrl: (url: string) => Promise<ServerProbeResult>;

  showNotification: (options: NotificationOptions) => void;
  setBadgeCount: (count: number, description: string) => void;

  isWindowFocused: () => Promise<boolean>;
  /** Devuelve la función para desuscribirse. */
  onWindowFocusChange: (callback: (focused: boolean) => void) => () => void;
  /** Devuelve la función para desuscribirse. */
  onOpenConversation: (callback: (conversationId: string) => void) => () => void;

  setTrayLabels: (labels: TrayLabels) => void;
  setMenuLabels: (labels: MenuLabels) => void;

  /** Se dispara cuando ya se descargó una versión nueva. Devuelve la función para desuscribirse. */
  onUpdateReady: (callback: (version: string) => void) => () => void;
  restartToUpdate: () => void;

  /** Lectura **síncrona** del JWT: `authStore` arma su estado inicial sin await. */
  getAuthToken: () => StoredToken;
  setAuthToken: (token: string | null) => void;

  /** Abre el login del proveedor en el navegador del sistema. */
  openSsoLogin: (provider: string) => Promise<boolean>;
  /** Devuelve la función para desuscribirse. */
  onSsoResult: (callback: (result: SsoResult) => void) => () => void;

  /** El main pide mostrar el selector de pantalla. Devuelve la función para desuscribirse. */
  onScreenPickRequest: (callback: (sources: ShareSource[]) => void) => () => void;
  /** Id elegido, o null si el usuario canceló. */
  respondScreenPick: (sourceId: string | null) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
