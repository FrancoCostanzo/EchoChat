import { app } from 'electron';
import path from 'node:path';
import { getMainWindow, showMainWindow } from './window';

/**
 * Deep links `echochat://`.
 *
 * Hoy el único uso es el retorno del SSO: la app abre el navegador del sistema
 * (ver ipc/sso.ipc.ts) y el backend redirige acá con el token en el fragmento.
 *
 * El esquema tiene que coincidir con `DESKTOP_CALLBACK` en
 * backend/src/controllers/auth.controller.ts.
 */

export const PROTOCOL = 'echochat';

/**
 * Nonce de la última solicitud de SSO. Un deep link cuyo `dstate` no coincida
 * se descarta: sin esto, cualquier programa local podría dispararle a la app un
 * `echochat://auth/callback#token=...` y dejarla logueada en una cuenta que
 * controla el atacante.
 */
let expectedState: string | null = null;

export function setExpectedSsoState(state: string): void {
  expectedState = state;
}

export function registerProtocol(): void {
  if (process.defaultApp) {
    // Sin empaquetar, el ejecutable es Electron y hay que decirle qué script
    // abrir; si no, el SO lanzaría Electron sin la app.
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

/** Extrae el deep link de una lista de argumentos (Windows y Linux lo pasan por argv). */
function findDeepLink(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`)) ?? null;
}

function handleUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return;
  }

  if (parsed.protocol !== `${PROTOCOL}:`) return;

  // `new URL('echochat://auth/callback')` deja host='auth' y pathname='/callback'.
  const route = `${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  if (route !== 'auth/callback') return;

  const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const win = showMainWindow();

  // Descarta cualquier deep link que no corresponda a un login que haya
  // iniciado esta app.
  if (!expectedState || params.get('dstate') !== expectedState) {
    win.webContents.send('sso:result', { error: 'unexpected' });
    return;
  }
  expectedState = null;

  const token = params.get('token');
  win.webContents.send('sso:result', token ? { token } : { error: 'failed' });
}

/**
 * Registra el manejo del deep link en las tres plataformas. Devuelve `false` si
 * ya hay otra instancia corriendo, en cuyo caso esta debe terminar.
 */
export function initDeepLinks(): boolean {
  // Una sola instancia: sin esto, cada deep link abriría una copia nueva de la
  // app en vez de llegarle a la que ya está abierta.
  if (!app.requestSingleInstanceLock()) return false;

  registerProtocol();

  // Windows y Linux: el SO relanza el ejecutable con la URL en argv y el lock
  // deriva ese arranque a la instancia viva.
  app.on('second-instance', (_event, argv) => {
    const url = findDeepLink(argv);
    if (url) handleUrl(url);
    else showMainWindow();
  });

  // macOS entrega la URL por evento, no por argv.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleUrl(url);
  });

  return true;
}

/**
 * Deep link con el que se arrancó la app en frío (Windows/Linux): pasa si el
 * usuario cerró la app en medio del SSO y el navegador vuelve después.
 *
 * Hay que esperar a que el renderer haya cargado: `webContents.send` sobre una
 * ventana que todavía no montó React no llega a ningún lado, y el resultado del
 * login se perdería en silencio.
 */
export function consumeLaunchDeepLink(): void {
  const url = findDeepLink(process.argv);
  if (!url) return;

  const win = getMainWindow();
  if (!win) return;

  win.webContents.once('did-finish-load', () => handleUrl(url));
}
