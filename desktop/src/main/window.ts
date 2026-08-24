import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { getBounds, getServerUrl, setBounds, type WindowBounds } from './config';
import { APP_ORIGIN } from './protocol';
import { applyWindowSecurity } from './security';
import { launchedHidden } from './autoLaunch';

/**
 * En desarrollo se carga el dev server de Vite de siempre (`frontend/`), así
 * que el HMR funciona igual que en la web. Se puede apuntar a otro puerto con
 * ELECTRON_RENDERER_URL.
 */
const DEV_RENDERER_URL = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173';

/**
 * Empaquetado siempre se sirve por `app://`; en desarrollo, por el dev server.
 * `ELECTRON_RENDERER_MODE=app` fuerza el modo de producción sin empaquetar,
 * que es la única forma de probar el handler de `app://` (fallback SPA, rutas
 * de assets, secure context) contra un `frontend/dist` recién buildeado sin
 * tener que generar un instalador.
 */
function useAppProtocol(): boolean {
  return app.isPackaged || process.env.ELECTRON_RENDERER_MODE === 'app';
}

const MIN_WIDTH = 940;
const MIN_HEIGHT = 600;

/**
 * Si el renderer crashea (OOM, un bug de GPU, lo que sea) más de esta cantidad
 * de veces en esta ventana de tiempo, se deja de reintentar recargar — evita
 * un loop infinito cuando lo que crashea es la propia carga de la página.
 */
const MAX_CRASH_RELOADS = 3;
const CRASH_RELOAD_WINDOW_MS = 30_000;

let mainWindow: BrowserWindow | null = null;
let recreating = false;
let hideOnClose = false;
let quitting = false;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

/**
 * Lo activa `tray.ts` una vez que existe el ícono de bandeja. Antes de eso
 * ocultar la ventana dejaría la app corriendo sin ninguna forma de volver.
 */
export function setHideOnClose(value: boolean): void {
  hideOnClose = value;
}

/** Marca que el cierre es definitivo, para que `close` no lo intercepte. */
export function markQuitting(): void {
  quitting = true;
}

/**
 * True mientras se está cambiando de servidor. `window-all-closed` lo consulta
 * para no cerrar la app en el instante en que la ventana vieja ya murió y la
 * nueva todavía no nació.
 */
export function isRecreatingWindow(): boolean {
  return recreating;
}

/**
 * Descarta la posición guardada si ya no cae dentro de ninguna pantalla
 * conectada — si no, al desconectar un monitor la ventana se restauraría
 * fuera de la vista y parecería que la app no abrió.
 */
function isOnSomeDisplay({ x, y }: WindowBounds): boolean {
  if (x === undefined || y === undefined) return false;

  return screen.getAllDisplays().some(({ workArea }) => (
    x >= workArea.x &&
    y >= workArea.y &&
    x < workArea.x + workArea.width &&
    y < workArea.y + workArea.height
  ));
}

function persistBounds(win: BrowserWindow): void {
  if (win.isDestroyed()) return;

  const normal = win.getNormalBounds();
  setBounds({
    x: normal.x,
    y: normal.y,
    width: normal.width,
    height: normal.height,
    maximized: win.isMaximized(),
  });
}

export function createMainWindow(): BrowserWindow {
  const saved = getBounds();
  const usePosition = isOnSomeDisplay(saved);

  const win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: usePosition ? saved.x : undefined,
    y: usePosition ? saved.y : undefined,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    // Se muestra recién en `ready-to-show` para evitar el flash blanco del
    // arranque, que en una app oscura como EchoChat se nota mucho.
    show: false,
    backgroundColor: '#0B0D14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // El preload no puede leer electron-store (corre en sandbox), así que la
      // URL del servidor viaja por argv y queda disponible de forma síncrona
      // apenas arranca el renderer. Cambiarla exige recrear la ventana.
      additionalArguments: [`--echochat-server-url=${getServerUrl()}`],
    },
  });

  if (saved.maximized) win.maximize();

  applyWindowSecurity(win);

  // Arrancada por el autostart del SO, la app va directo a la bandeja: aparecer
  // en primer plano al prender la computadora sería intrusivo.
  win.once('ready-to-show', () => {
    if (!launchedHidden()) win.show();
  });

  win.on('close', (event) => {
    persistBounds(win);

    // Con tray, cerrar oculta: es lo que esperan los usuarios de una app de
    // mensajería, que tiene que seguir recibiendo mensajes en segundo plano.
    // `quitting` distingue "el usuario cerró la ventana" de "el usuario eligió
    // Salir", que sí tiene que terminar el proceso.
    if (hideOnClose && !quitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Sin esto, un renderer muerto deja la ventana en blanco para siempre: no
  // hay ningún otro mecanismo de recuperación. `webContents` sobrevive al
  // renderer que murió, así que recargar alcanza para levantarlo de nuevo.
  const crashTimestamps: number[] = [];
  win.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || win.isDestroyed()) return;

    console.error(`[window] render process gone: ${details.reason}`);

    const now = Date.now();
    crashTimestamps.push(now);
    while (crashTimestamps.length && now - crashTimestamps[0] > CRASH_RELOAD_WINDOW_MS) {
      crashTimestamps.shift();
    }
    if (crashTimestamps.length > MAX_CRASH_RELOADS) {
      console.error('[window] demasiados crashes seguidos, no se reintenta más');
      return;
    }

    win.webContents.reload();
  });

  // La presencia del usuario depende de si está mirando la app. En Electron
  // `document.hidden` sólo es true con la ventana minimizada, no cuando está
  // detrás de otra, así que el foco real se manda desde acá.
  const sendFocus = (focused: boolean) => {
    if (!win.isDestroyed()) win.webContents.send('window:focus-changed', focused);
  };
  win.on('focus', () => sendFocus(true));
  win.on('blur', () => sendFocus(false));
  win.on('minimize', () => sendFocus(false));
  win.on('restore', () => sendFocus(win.isFocused()));

  void win.loadURL(useAppProtocol() ? `${APP_ORIGIN}/` : DEV_RENDERER_URL);

  mainWindow = win;
  return win;
}

/** Trae la ventana al frente, recreándola si ya no existe (macOS, o tras cerrar). */
export function showMainWindow(): BrowserWindow {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : createMainWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return win;
}

/**
 * Recrea la ventana para que el preload reciba la nueva URL de servidor por
 * argv. Un `reload()` no alcanza: `additionalArguments` se fija al construir
 * el BrowserWindow.
 */
export function recreateMainWindow(): BrowserWindow {
  const previous = mainWindow;
  mainWindow = null;
  recreating = true;

  try {
    if (previous && !previous.isDestroyed()) {
      persistBounds(previous);
      previous.destroy();
    }
    return createMainWindow();
  } finally {
    recreating = false;
  }
}
