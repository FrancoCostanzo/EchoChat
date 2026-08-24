import { safeStorage } from 'electron';
import { getEncryptedToken, setEncryptedToken } from './config';

/**
 * JWT de sesión cifrado en reposo con el llavero del SO (DPAPI en Windows,
 * Keychain en macOS, libsecret/kwallet en Linux).
 *
 * En la web el token vive en `localStorage`, que en Electron sería un archivo
 * en claro dentro del userData: cualquier programa que corra como el mismo
 * usuario podría leerlo y usarlo hasta que expire.
 *
 * Si el SO no ofrece cifrado —pasa en Linux sin llavero configurado— NO se
 * escribe nada: se le avisa al renderer y este sigue con `localStorage`.
 * Guardar el token en un archivo propio sin cifrar no sería mejor que eso, y
 * sí sería más difícil de auditar.
 */

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function readToken(): string | null {
  if (!isEncryptionAvailable()) return null;

  const stored = getEncryptedToken();
  if (!stored) return null;

  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    // El material de cifrado del SO cambió (perfil nuevo, llavero recreado):
    // el token guardado ya no sirve. Se descarta y el usuario vuelve a entrar.
    setEncryptedToken(null);
    return null;
  }
}

export function writeToken(token: string | null): void {
  if (!isEncryptionAvailable()) return;

  setEncryptedToken(token ? safeStorage.encryptString(token).toString('base64') : null);
}
