import { ipcMain, net } from 'electron';
import { getServerUrl, serverUrlCandidates, setServerUrl } from '../config';
import { recreateMainWindow } from '../window';

/**
 * Motivos de fallo al probar un servidor. El renderer los traduce (es/en/pt);
 * acá viajan como códigos para no meter i18n en el main process.
 */
export type ServerProbeError = 'invalid-url' | 'unreachable' | 'not-echochat' | 'degraded';

export interface ServerProbeResult {
  ok: boolean;
  /** La URL ya normalizada, sólo cuando `ok` es true. */
  url?: string;
  error?: ServerProbeError;
}

const PROBE_TIMEOUT_MS = 8_000;

/**
 * Verifica que una URL concreta apunte a un backend de EchoChat. Se usa
 * `net.fetch` (el stack de red de Electron, desde el main) y no el `fetch` del
 * renderer para no depender de que el CORS del servidor ya esté configurado:
 * si el servidor existe pero rechaza el origin, queremos decírselo al usuario,
 * no fallar con un error de red opaco.
 */
async function probeOne(url: string): Promise<ServerProbeResult> {
  let response: Response;
  try {
    response = await net.fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, error: 'unreachable' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Respondió algo que no es JSON: hay un servidor ahí, pero no es EchoChat
    // (típico: el proxy corporativo o una landing page).
    return { ok: false, error: 'not-echochat' };
  }

  // La firma del health check de EchoChat (ver backend/src/app.ts:79-84).
  if (typeof body !== 'object' || body === null || !('db' in body) || !('status' in body)) {
    return { ok: false, error: 'not-echochat' };
  }

  // 503 con db caída: es EchoChat, pero conectarse no serviría de nada.
  if ((body as { status: unknown }).status !== 'ok') {
    return { ok: false, error: 'degraded' };
  }

  return { ok: true, url };
}

/**
 * Prueba los candidatos en orden y devuelve el primero que sirva. Si ninguno
 * anda, informa el error más específico: que https no conteste pero http diga
 * "no es EchoChat" es mucho más útil que un "no se pudo contactar" genérico.
 */
async function probeServer(raw: unknown): Promise<ServerProbeResult> {
  const candidates = serverUrlCandidates(raw);
  if (candidates.length === 0) return { ok: false, error: 'invalid-url' };

  const failures: ServerProbeResult[] = [];
  for (const url of candidates) {
    const result = await probeOne(url);
    if (result.ok) return result;
    failures.push(result);
  }

  return failures.find((f) => f.error !== 'unreachable') ?? failures[0];
}

export function registerServerIpc(): void {
  ipcMain.handle('server:get-url', () => getServerUrl());

  ipcMain.handle('server:test', (_event, raw: unknown) => probeServer(raw));

  ipcMain.handle('server:set-url', async (_event, raw: unknown): Promise<ServerProbeResult> => {
    const result = await probeServer(raw);
    if (!result.ok || !result.url) return result;

    setServerUrl(result.url);
    // La URL llega al renderer por `additionalArguments`, que se fija al
    // construir el BrowserWindow: hay que rehacerlo, no alcanza con recargar.
    recreateMainWindow();

    return result;
  });
}
