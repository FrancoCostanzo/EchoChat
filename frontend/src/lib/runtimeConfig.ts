import '@/types/electron';

/**
 * Resuelve contra qué servidor habla esta instancia del frontend.
 *
 * En la web la respuesta es siempre `''`: el bundle se sirve desde el mismo
 * origin que el backend, así que `/api` y `/socket.io` son relativos y los
 * resuelve el proxy (Vite en dev, nginx en producción).
 *
 * En Electron no hay proxy ni origin compartido — el renderer corre en
 * `app://echochat` — así que hace falta una URL absoluta, que además tiene que
 * ser configurable en runtime: el instalador es el mismo para todos y cada
 * organización apunta al suyo.
 */

/** Ver docs/STYLE_GUIDE.md § Reutilización de Código. */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

/**
 * Base absoluta del servidor (`https://chat.empresa.com`), o `''` para seguir
 * usando rutas relativas. Es síncrona a propósito: `lib/api.ts` la necesita en
 * cada request.
 */
export function getServerUrl(): string {
  return window.electronAPI?.getServerUrl() ?? '';
}

/** True cuando corremos en Electron y todavía no se eligió un servidor. */
export function needsServerSetup(): boolean {
  return isElectron() && !getServerUrl();
}
