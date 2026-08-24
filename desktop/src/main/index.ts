import { app, session } from 'electron';
import { handleAppProtocol, registerAppScheme } from './protocol';
import { applySessionPermissions } from './security';
import { applyScreenShareHandler } from './screenShare';
import { consumeLaunchDeepLink, initDeepLinks } from './deepLink';
import { createMainWindow, isRecreatingWindow, markQuitting, showMainWindow } from './window';
import { destroyTray } from './tray';
import { initAutoUpdater } from './updater';
import { registerServerIpc } from './ipc/server.ipc';
import { registerNotificationIpc } from './ipc/notification.ipc';
import { registerAppIpc } from './ipc/app.ipc';
import { registerUpdateIpc } from './ipc/update.ipc';
import { registerSsoIpc } from './ipc/sso.ipc';
import { registerAuthIpc } from './ipc/auth.ipc';

// Tiene que correr antes de `whenReady`: los esquemas privilegiados se declaran
// en el arranque del proceso, no después.
registerAppScheme();

// Si ya hay otra instancia, esta termina: el lock le reenvía a la viva el deep
// link con el que se la invocó (ver deepLink.ts).
if (!initDeepLinks()) {
  app.quit();
} else {
  void app.whenReady().then(() => {
    handleAppProtocol();
    applySessionPermissions(session.defaultSession);
    applyScreenShareHandler(session.defaultSession);

    registerServerIpc();
    registerNotificationIpc();
    registerAppIpc();
    registerUpdateIpc();
    registerSsoIpc();
    registerAuthIpc();

    createMainWindow();
    consumeLaunchDeepLink();
    initAutoUpdater();

    // En macOS es esperable que la app siga viva sin ventanas y que al hacer
    // click en el dock se vuelva a mostrar.
    app.on('activate', () => showMainWindow());
  });
}

app.on('before-quit', () => {
  markQuitting();
  destroyTray();
});

app.on('window-all-closed', () => {
  // Con tray, cerrar la ventana sólo la oculta y la app sigue recibiendo
  // mensajes; salir de verdad es una acción explícita del menú de bandeja.
  if (process.platform === 'darwin') return;
  if (isRecreatingWindow()) return;
  app.quit();
});
