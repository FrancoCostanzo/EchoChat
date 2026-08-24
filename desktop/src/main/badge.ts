import { app, nativeImage, type BrowserWindow } from 'electron';

/**
 * Indicador de no leídos en la barra de tareas / dock.
 *
 * No hay una API única que sirva en los tres SO:
 *   - macOS y Linux (Unity): `app.setBadgeCount` pinta el número solo.
 *   - Windows: `setBadgeCount` no hace nada; el equivalente es un ícono
 *     superpuesto sobre el de la barra de tareas.
 */

const OVERLAY_SIZE = 32;
const ACCENT: [number, number, number] = [0x4f, 0x8a, 0xff]; // el azul de acento de la UI

/**
 * Punto relleno como bitmap BGRA crudo. Se dibuja a mano en vez de empaquetar
 * un PNG para no tener que mantener un asset por variante de color, y porque
 * `createFromBitmap` no necesita ningún decodificador.
 */
function buildOverlayDot(): Electron.NativeImage {
  const size = OVERLAY_SIZE;
  const buffer = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size / 2 - 1;
  const [b, g, r] = ACCENT;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - center, y - center);
      // Franja de 1px de transición para que el borde no quede dentado.
      const alpha = Math.round(255 * Math.min(1, Math.max(0, radius - distance)));
      const offset = (y * size + x) * 4;
      buffer[offset] = b;
      buffer[offset + 1] = g;
      buffer[offset + 2] = r;
      buffer[offset + 3] = alpha;
    }
  }

  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}

let overlayDot: Electron.NativeImage | null = null;

/**
 * `description` es el texto que leen los lectores de pantalla sobre el ícono
 * superpuesto en Windows; lo manda el renderer ya traducido, porque el main no
 * tiene i18n.
 */
export function setUnreadBadge(win: BrowserWindow | null, count: number, description = ''): void {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;

  if (process.platform === 'win32') {
    if (!win || win.isDestroyed()) return;
    if (safe === 0) {
      win.setOverlayIcon(null, '');
      return;
    }
    overlayDot ??= buildOverlayDot();
    win.setOverlayIcon(overlayDot, description);
    return;
  }

  app.setBadgeCount(safe);
}
