import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getMainWindow, markQuitting } from './window';

/**
 * Actualizaciones automáticas contra los releases de GitHub.
 *
 * La actualización se descarga sola en segundo plano y recién ahí se le avisa
 * al renderer, que muestra un aviso con un botón para reiniciar. No se
 * reinicia por las nuestras: cortarle una conversación a alguien para instalar
 * una versión nueva es peor que esperar.
 */

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 h

export function initAutoUpdater(): void {
  // Sin empaquetar no hay feed ni versión firmada contra la que comparar:
  // electron-updater falla siempre. Nada que hacer en desarrollo.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  // Si el usuario nunca toca el aviso, la actualización se aplica igual la
  // próxima vez que cierre la app.
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    getMainWindow()?.webContents.send('update:ready', info.version);
  });

  autoUpdater.on('error', (error) => {
    // Que falle el chequeo no puede romper la app: puede no haber red, o
    // haber un proxy corporativo que bloquee GitHub, que es justo el entorno
    // donde más se despliega EchoChat.
    console.error('[updater]', error instanceof Error ? error.message : error);
  });

  const check = () => { void autoUpdater.checkForUpdates().catch(() => {}); };

  check();
  setInterval(check, CHECK_INTERVAL_MS);
}

/** Reinicia e instala. Lo dispara el usuario desde el aviso del renderer. */
export function quitAndInstallUpdate(): void {
  // Sin esto, el handler de `close` ocultaría la ventana a la bandeja en vez
  // de dejar que la app termine, y la instalación nunca arrancaría.
  markQuitting();
  autoUpdater.quitAndInstall();
}
