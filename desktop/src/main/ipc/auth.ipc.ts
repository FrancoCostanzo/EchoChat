import { ipcMain } from 'electron';
import { isEncryptionAvailable, readToken, writeToken } from '../authToken';

/** Lo que devuelve la lectura síncrona del token. */
export interface StoredToken {
  /** false = el SO no ofrece cifrado; el renderer se queda con localStorage. */
  available: boolean;
  token: string | null;
}

export function registerAuthIpc(): void {
  // Síncrono a propósito: `authStore` arma su estado inicial con el token en el
  // inicializador del store, sin await. Hacerlo asíncrono obligaría a un primer
  // render como "no autenticado" y un parpadeo hacia el login — y eso cambiaría
  // también el arranque de la web, que comparte ese código.
  //
  // Es una sola llamada por arranque y sobre un valor chico, que es exactamente
  // el caso para el que `sendSync` está bien.
  ipcMain.on('auth:get-token', (event) => {
    const result: StoredToken = {
      available: isEncryptionAvailable(),
      token: readToken(),
    };
    event.returnValue = result;
  });

  ipcMain.on('auth:set-token', (_event, raw: unknown) => {
    if (raw !== null && typeof raw !== 'string') return;
    writeToken(raw);
  });
}
