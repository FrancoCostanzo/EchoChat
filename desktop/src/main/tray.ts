import { app, Menu, nativeImage, Tray } from 'electron';
import path from 'node:path';
import { setServerUrl } from './config';
import { isAutoLaunchEnabled, setAutoLaunch } from './autoLaunch';
import { recreateMainWindow, setHideOnClose, showMainWindow } from './window';

/**
 * Ícono de bandeja y su menú.
 *
 * Las etiquetas llegan traducidas desde el renderer (`tray:set-labels`): el
 * main no tiene i18n y el idioma lo elige el usuario en la app. Hasta que el
 * renderer las manda, el tray no se crea — así nunca se ve un menú a medio
 * traducir.
 */

export interface TrayLabels {
  open: string;
  muteNotifications: string;
  autoLaunch: string;
  changeServer: string;
  quit: string;
  tooltip: string;
}

let tray: Tray | null = null;
let labels: TrayLabels | null = null;
let muted = false;

export function notificationsMuted(): boolean {
  return muted;
}

function iconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.resolve(__dirname, '../../resources/icon.png');
}

function buildMenu(): Menu {
  const current = labels!;

  return Menu.buildFromTemplate([
    { label: current.open, click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: current.muteNotifications,
      type: 'checkbox',
      checked: muted,
      click: (item) => { muted = item.checked; },
    },
    {
      label: current.autoLaunch,
      type: 'checkbox',
      checked: isAutoLaunchEnabled(),
      click: (item) => {
        setAutoLaunch(item.checked);
        // Se relee del SO en vez de confiar en el click: si la escritura falló
        // (permisos en Linux), el tilde tiene que volver a como está de verdad.
        refreshTrayMenu();
      },
    },
    {
      label: current.changeServer,
      click: () => {
        // Vaciar la URL hace que el próximo arranque del renderer muestre la
        // pantalla de configuración (ver frontend/src/Root.tsx).
        setServerUrl('');
        recreateMainWindow();
      },
    },
    { type: 'separator' },
    { label: current.quit, click: () => app.quit() },
  ]);
}

/** Refresca (o crea) el tray con las etiquetas que mandó el renderer. */
export function setTrayLabels(next: TrayLabels): void {
  labels = next;

  if (!tray) {
    const file = iconPath();
    const icon = nativeImage.createFromPath(file);

    // Si el ícono no carga, `new Tray` daría un ícono invisible (o tiraría) y
    // la app quedaría sin forma de volver tras ocultarse. Mejor no tener tray
    // y que cerrar cierre de verdad.
    if (icon.isEmpty()) {
      console.error(`[tray] no se pudo cargar el ícono: ${file}`);
      return;
    }

    // 16px es el tamaño de bandeja en Windows y Linux; en macOS el template
    // se escala solo.
    const resized = icon.resize({ width: 16, height: 16 });
    if (process.platform === 'darwin') resized.setTemplateImage(true);

    try {
      tray = new Tray(resized);
    } catch (error) {
      console.error('[tray] no se pudo crear el ícono de bandeja:', error);
      return;
    }

    tray.on('click', () => showMainWindow());
    tray.on('double-click', () => showMainWindow());

    // Recién ahora cerrar puede significar "ocultar": antes de que exista el
    // tray, ocultar la ventana dejaría la app sin ninguna forma de volver.
    setHideOnClose(true);
  }

  tray.setToolTip(next.tooltip);
  tray.setContextMenu(buildMenu());
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
  setHideOnClose(false);
}

function refreshTrayMenu(): void {
  if (tray && labels) tray.setContextMenu(buildMenu());
}
