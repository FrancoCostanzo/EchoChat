import { shell, type BrowserWindow, type Session } from 'electron';
import { getServerUrl } from './config';
import { APP_ORIGIN } from './protocol';

/**
 * Lo que en un navegador cubre el propio navegador y en Electron hay que
 * poner a mano: abrir links afuera, no dejar que la ventana navegue a
 * cualquier lado, y acotar los permisos.
 */

/** Origins desde los que legítimamente se sirve el renderer. */
function rendererOrigins(): string[] {
  return [APP_ORIGIN, process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'];
}

function isRendererUrl(url: string): boolean {
  return rendererOrigins().some((origin) => url === origin || url.startsWith(`${origin}/`));
}

/** Sólo se abren afuera esquemas de navegación normales, nunca `file:` ni customs. */
function isSafeExternal(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

/**
 * Todo link que salga de la app va al navegador del sistema.
 *
 * Sin esto, cualquier link que un usuario mande por chat (los renderiza
 * `MessageBody` con `target="_blank"`) abriría una ventana de Electron con el
 * contexto de la app cargado. Es seguridad, no comodidad.
 */
export function applyWindowSecurity(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // La ventana principal nunca navega fuera del renderer. Cubre el caso
  // clásico de soltar un archivo fuera de la zona de drop: sin este guard,
  // Electron navega al archivo y la app desaparece sin forma de volver.
  win.webContents.on('will-navigate', (event, url) => {
    if (isRendererUrl(url)) return;
    event.preventDefault();
    if (isSafeExternal(url)) void shell.openExternal(url);
  });

  // Un attach de webview no tiene ningún uso legítimo acá.
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
}

/**
 * Cabeceras CSP del renderer. Se arman en runtime porque `connect-src` depende
 * del servidor que haya configurado el usuario, que puede cambiar sin
 * reinstalar la app.
 *
 * Van como cabecera de la respuesta de `app://` (ver protocol.ts) en lugar de
 * un `<meta>` en el index.html, justamente porque el index.html es un artefacto
 * compartido con la web y no puede saber esta URL.
 */
export function contentSecurityPolicy(): string {
  const server = getServerUrl();

  // El backend y el WebSocket viven en el mismo host; MinIO puede estar en otro
  // puerto del mismo, así que se habilita el host entero para conectar.
  const connect = new Set<string>(["'self'"]);
  const image = new Set<string>(["'self'", 'data:', 'blob:']);
  const media = new Set<string>(["'self'", 'blob:', 'data:']);

  if (server) {
    try {
      const { host, protocol } = new URL(server);
      const ws = protocol === 'https:' ? 'wss:' : 'ws:';
      for (const source of [`${protocol}//${host}`, `${ws}//${host}`]) connect.add(source);
      // Las presigned de MinIO pueden salir por otro puerto del mismo host.
      for (const target of [connect, image, media]) target.add(`${protocol}//${host}`);
    } catch {
      // Una serverUrl inválida no debería poder llegar hasta acá (la valida
      // config.serverUrlCandidates), pero si llega, mejor una CSP restrictiva
      // que una rota.
    }
  }

  // Giphy es opcional y ya está detrás de un feature flag en el frontend, pero
  // si está activo necesita su API y su CDN de imágenes.
  connect.add('https://api.giphy.com');
  image.add('https://media.giphy.com');
  image.add('https://*.giphy.com');

  return [
    "default-src 'self'",
    // 'unsafe-inline' en estilos: Tailwind y Framer Motion inyectan estilos
    // inline en runtime. En scripts NO se permite.
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
    'font-src \'self\' data: https://cdn.fontshare.com',
    "script-src 'self'",
    `connect-src ${[...connect].join(' ')} https://api.fontshare.com https://cdn.fontshare.com`,
    `img-src ${[...image].join(' ')}`,
    `media-src ${[...media].join(' ')}`,
    // pdfjs instancia su worker desde un blob.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Permisos del renderer. Se concede sólo lo que la app usa de verdad
 * (micrófono y cámara para las llamadas) y sólo si lo pide nuestro propio
 * renderer; el resto se niega sin preguntar.
 */
export function applySessionPermissions(session: Session): void {
  const ALLOWED = new Set(['media', 'clipboard-sanitized-write']);

  session.setPermissionRequestHandler((contents, permission, callback) => {
    callback(isRendererUrl(contents.getURL()) && ALLOWED.has(permission));
  });

  session.setPermissionCheckHandler((_contents, permission, origin) => {
    return ALLOWED.has(permission) && isRendererUrl(origin);
  });
}
