import Store from 'electron-store';

/** Posición y tamaño de la ventana, para restaurarla donde el usuario la dejó. */
export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface DesktopConfig {
  /**
   * URL del servidor EchoChat contra el que habla esta instalación
   * (ej. `https://chat.empresa.com`). Vacía hasta que el usuario la configura:
   * el instalador es el mismo para todos, el servidor lo elige cada cliente.
   */
  serverUrl: string;
  bounds: WindowBounds;
}

const DEFAULTS: DesktopConfig = {
  serverUrl: '',
  bounds: { width: 1280, height: 800, maximized: false },
};

const store = new Store<DesktopConfig>({ name: 'echochat', defaults: DEFAULTS });

export function getServerUrl(): string {
  return store.get('serverUrl');
}

export function setServerUrl(url: string): void {
  store.set('serverUrl', url);
}

export function getBounds(): WindowBounds {
  return store.get('bounds');
}

export function setBounds(bounds: WindowBounds): void {
  store.set('bounds', bounds);
}

/**
 * Normaliza una URL con esquema explícito y rechaza cualquier cosa que no sea
 * http(s). Devuelve la URL sin barra final o `null` si no es válida.
 */
function normalize(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;

  return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
}

/**
 * Convierte lo que escribió el usuario en las URLs a probar, en orden.
 *
 * Si no puso esquema se prueban las dos: EchoChat se despliega mucho puertas
 * adentro, donde `chat.interno:3000` sin TLS es tan común como un dominio con
 * https. Asumir sólo https haría fallar esos casos con un "no se pudo
 * contactar al servidor" que manda a buscar el problema donde no está.
 *
 * También es la validación de lo que llega por IPC (ver docs/STYLE_GUIDE.md
 * § Seguridad): el renderer nunca es una fuente confiable, aunque sea nuestro
 * propio frontend. Devuelve `[]` si la entrada no sirve.
 */
export function serverUrlCandidates(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  const attempts = /^https?:\/\//i.test(trimmed)
    ? [trimmed]
    : [`https://${trimmed}`, `http://${trimmed}`];

  return attempts
    .map(normalize)
    .filter((url): url is string => url !== null);
}
