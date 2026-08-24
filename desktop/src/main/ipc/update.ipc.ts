import { ipcMain } from 'electron';
import { quitAndInstallUpdate } from '../updater';

export function registerUpdateIpc(): void {
  ipcMain.on('update:restart', () => quitAndInstallUpdate());
}
