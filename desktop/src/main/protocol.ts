import { app, net, protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentSecurityPolicy } from './security';

export const APP_SCHEME = 'app';
export const APP_HOST = 'echochat';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * Se sirve el frontend por un esquema propio en vez de `file://` porque
 * `app://` es un origin real: mantiene `BrowserRouter` funcionando (con el
 * fallback a index.html de abajo), deja que Vite siga usando `base: '/'` para
 * los chunks de React.lazy y el worker de pdfjs, y — al declararse `secure` —
 * habilita el secure context que `navigator.clipboard` y `localStorage`
 * necesitan. Con `file://` habría que tocar las cuatro cosas en el frontend
 * compartido con la web.
 *
 * Tiene que llamarse ANTES de `app.whenReady()`.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

/**
 * Dónde vive el `frontend/dist` según estemos empaquetados o no.
 * Empaquetado llega como `extraResources` (ver electron-builder.yml); en
 * desarrollo se lee directamente del working copy.
 */
function getRendererPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'renderer')
    : path.resolve(__dirname, '../../../frontend/dist');
}

/** Registra el handler de `app://`. Tiene que llamarse DESPUÉS de `app.whenReady()`. */
export function handleAppProtocol(): void {
  const root = getRendererPath();

  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, '');

    // El renderer no debería poder pedir nada fuera de dist/, ni siquiera con
    // un `..` en la URL.
    const resolved = path.resolve(root, relative);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Fallback SPA: cualquier ruta que no sea un archivo real (/chat/42,
    // /settings/profile, …) devuelve index.html y la resuelve react-router.
    // Es lo mismo que hace hoy el `try_files` de nginx en producción web.
    const isFile = relative !== '' && fs.existsSync(resolved) && fs.statSync(resolved).isFile();
    const target = isFile ? resolved : path.join(root, 'index.html');

    const response = await net.fetch(pathToFileURL(target).toString());

    // La CSP viaja como cabecera del documento, no como <meta> en el
    // index.html: ese archivo se comparte con la web y no puede saber a qué
    // servidor apunta esta instalación.
    if (!isFile) {
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', contentSecurityPolicy());
      return new Response(response.body, { status: response.status, headers });
    }

    return response;
  });
}
