import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Arranque con el sistema.
 *
 * En Windows y macOS lo resuelve Electron. En Linux **no**:
 * `setLoginItemSettings` no está implementado ahí, así que hay que escribir a
 * mano un `.desktop` en `~/.config/autostart` — y apuntando al AppImage
 * original, no al binario que se extrae en /tmp al ejecutarlo.
 */

/** Se pasa al relanzar desde el arranque del SO: la app va directo a la bandeja. */
export const HIDDEN_FLAG = '--hidden';

export function launchedHidden(): boolean {
  return process.argv.includes(HIDDEN_FLAG);
}

function autostartFile(): string {
  return path.join(os.homedir(), '.config', 'autostart', 'echochat.desktop');
}

function linuxExecPath(): string {
  // Dentro de un AppImage, `process.execPath` es el binario desempaquetado en
  // un directorio temporal que no existe en el próximo arranque.
  return process.env.APPIMAGE || process.execPath;
}

export function isAutoLaunchEnabled(): boolean {
  if (process.platform === 'linux') return fs.existsSync(autostartFile());
  return app.getLoginItemSettings().openAtLogin;
}

export function setAutoLaunch(enabled: boolean): void {
  if (process.platform === 'linux') {
    const file = autostartFile();

    if (!enabled) {
      fs.rmSync(file, { force: true });
      return;
    }

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, [
      '[Desktop Entry]',
      'Type=Application',
      'Name=EchoChat',
      `Exec=${linuxExecPath()} ${HIDDEN_FLAG}`,
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n'), 'utf8');
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    // macOS entiende esto; en Windows el que hace el trabajo es el argumento.
    openAsHidden: true,
    args: [HIDDEN_FLAG],
  });
}
