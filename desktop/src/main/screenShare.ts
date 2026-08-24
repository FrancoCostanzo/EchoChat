import { desktopCapturer, ipcMain, type Session } from 'electron';
import { getMainWindow } from './window';

/**
 * Selector de pantalla/ventana para compartir.
 *
 * En un navegador, `getDisplayMedia()` abre el selector nativo de Chrome. En
 * Electron ese selector no existe: la app tiene que enumerar las fuentes con
 * `desktopCapturer` y construir su propia UI. Acá el main junta las fuentes con
 * sus miniaturas y le pide al renderer que muestre el diálogo, porque la UI
 * (y su i18n) vive del lado de React.
 */

const THUMBNAIL = { width: 320, height: 180 };
/** Si el usuario no elige nada, no dejamos la petición colgada para siempre. */
const PICK_TIMEOUT_MS = 2 * 60 * 1000;

export interface ShareSource {
  id: string;
  name: string;
  /** PNG en data: URI, listo para un <img>. */
  thumbnail: string;
  /** Pantalla completa vs. ventana de una app, para agrupar en la UI. */
  kind: 'screen' | 'window';
}

let pending: ((sourceId: string | null) => void) | null = null;

/** Respuesta del renderer: el id elegido, o null si canceló. */
function registerPickResponse(): void {
  ipcMain.on('screen:pick-response', (_event, raw: unknown) => {
    const resolve = pending;
    if (!resolve) return;
    pending = null;
    resolve(typeof raw === 'string' && raw ? raw : null);
  });
}

async function askUserToPick(): Promise<string | null> {
  const win = getMainWindow();
  if (!win) return null;

  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: THUMBNAIL,
  });

  const payload: ShareSource[] = sources
    // Sin miniatura la opción sería un cuadro vacío: normalmente es una ventana
    // que se cerró entre la enumeración y la captura.
    .filter((source) => !source.thumbnail.isEmpty())
    .map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      kind: source.id.startsWith('screen:') ? 'screen' : 'window',
    }));

  if (payload.length === 0) return null;

  return new Promise<string | null>((resolve) => {
    // Una petición nueva cancela la anterior en vez de encolarse.
    pending?.(null);

    const timer = setTimeout(() => {
      pending = null;
      resolve(null);
    }, PICK_TIMEOUT_MS);

    pending = (sourceId) => {
      clearTimeout(timer);
      resolve(sourceId);
    };

    win.webContents.send('screen:pick-request', payload);
  });
}

export function applyScreenShareHandler(session: Session): void {
  registerPickResponse();

  session.setDisplayMediaRequestHandler((_request, callback) => {
    void (async () => {
      const sourceId = await askUserToPick();
      if (!sourceId) {
        // Un objeto vacío cancela la petición: getDisplayMedia rechaza y
        // callStore ya trata eso como "el usuario canceló".
        callback({});
        return;
      }

      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
      });
      const chosen = sources.find((source) => source.id === sourceId);

      callback(chosen ? { video: chosen } : {});
    })();
  });
}
