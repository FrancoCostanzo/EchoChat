import crypto from 'node:crypto';
import { ipcMain, shell } from 'electron';
import { getServerUrl } from '../config';
import { setExpectedSsoState } from '../deepLink';

/**
 * El login SSO se abre en el navegador del sistema, no dentro de la app.
 *
 * En la web esto es `window.location.href = ...`, pero en Electron una
 * navegación de página completa destruiría el renderer. Además, el navegador
 * del sistema es donde el usuario ya tiene su sesión corporativa, y no le pide
 * que escriba sus credenciales dentro de una ventana que no puede inspeccionar.
 *
 * La vuelta es por el deep link `echochat://auth/callback` (ver deepLink.ts).
 */

/** El nombre del proveedor arma una URL: se valida antes de concatenarlo. */
const PROVIDER_PATTERN = /^[a-z0-9_-]{1,40}$/i;

export function registerSsoIpc(): void {
  ipcMain.handle('sso:open', (_event, raw: unknown): boolean => {
    const serverUrl = getServerUrl();
    if (!serverUrl) return false;
    if (typeof raw !== 'string' || !PROVIDER_PATTERN.test(raw)) return false;

    // Se le devuelve tal cual en el deep link para poder descartar los que no
    // haya pedido esta app.
    const state = crypto.randomUUID();
    setExpectedSsoState(state);

    const url = new URL(`${serverUrl}/api/auth/sso/${raw}/login`);
    url.searchParams.set('client', 'desktop');
    url.searchParams.set('dstate', state);

    void shell.openExternal(url.toString());
    return true;
  });
}
