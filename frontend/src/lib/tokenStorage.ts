/**
 * Dónde vive el JWT de sesión.
 *
 * En la web, `localStorage` — es lo único que hay. En Electron se guarda
 * cifrado con el llavero del SO (`safeStorage`), porque ahí `localStorage` es
 * un archivo en claro dentro del userData que cualquier programa del mismo
 * usuario podría leer.
 *
 * La API es **síncrona** a propósito: `authStore` arma su estado inicial en el
 * inicializador del store, sin await. Volverla asíncrona obligaría a un primer
 * render como "no autenticado" y un parpadeo hacia el login, y ese código lo
 * comparten la web y el escritorio.
 */

const TOKEN_KEY = 'echochat_token';

/**
 * Se resuelve una sola vez al cargar el módulo. Si el SO no ofrece cifrado
 * (típico en Linux sin llavero), se sigue con localStorage: guardar el token en
 * un archivo propio sin cifrar no sería mejor y sería más difícil de auditar.
 */
const initial = window.electronAPI?.getAuthToken();
const useSafeStorage = initial?.available ?? false;

/** Espejo en memoria: evita un `sendSync` por cada lectura. */
let cached: string | null = useSafeStorage ? (initial?.token ?? null) : null;

if (useSafeStorage) {
  // Instalaciones anteriores a esto guardaban el token en localStorage. Se
  // migra para no desloguear a nadie al actualizar, y se borra la copia en
  // claro — que es justamente lo que este cambio viene a eliminar.
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (legacy) {
    if (!cached) {
      cached = legacy;
      window.electronAPI?.setAuthToken(legacy);
    }
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredToken(): string | null {
  return useSafeStorage ? cached : localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (useSafeStorage) {
    cached = token;
    window.electronAPI?.setAuthToken(token);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (useSafeStorage) {
    cached = null;
    window.electronAPI?.setAuthToken(null);
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
}
