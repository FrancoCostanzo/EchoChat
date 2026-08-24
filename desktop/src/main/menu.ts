import { app, Menu, type MenuItemConstructorOptions } from 'electron';

/**
 * Menú de aplicación propio.
 *
 * `autoHideMenuBar` (ver window.ts) sólo lo oculta: en Windows/Linux `Alt`
 * sigue revelando el menú por defecto de Electron, en inglés y con
 * Reload/Toggle DevTools expuestos. Este módulo lo reemplaza por uno propio,
 * sin nada de desarrollo, con las etiquetas que manda el renderer
 * (`menu:set-labels`, mismo patrón que `tray.ts`).
 *
 * Se setea con `labels: null` apenas arranca la app (antes de que exista
 * cualquier ventana), no de forma perezosa como el tray: en macOS, el menú
 * `Edit` con los roles `cut`/`copy`/`paste` es lo que hace que `Cmd+C/V/X`
 * funcionen en los inputs. Sin `role`/`label` explícito, Electron usa el
 * label por defecto de cada rol, así que el hueco hasta que llegan las
 * traducciones reales es sólo cosmético.
 */

export interface MenuLabels {
  edit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  selectAll: string;
  hide: string;
  hideOthers: string;
  unhide: string;
  quit: string;
  window: string;
  minimize: string;
  close: string;
}

function buildTemplate(labels: MenuLabels | null): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide', label: labels?.hide },
        { role: 'hideOthers', label: labels?.hideOthers },
        { role: 'unhide', label: labels?.unhide },
        { type: 'separator' },
        { role: 'quit', label: labels?.quit },
      ],
    });
  }

  template.push({
    label: labels?.edit ?? 'Edit',
    submenu: [
      { role: 'undo', label: labels?.undo },
      { role: 'redo', label: labels?.redo },
      { type: 'separator' },
      { role: 'cut', label: labels?.cut },
      { role: 'copy', label: labels?.copy },
      { role: 'paste', label: labels?.paste },
      { role: 'selectAll', label: labels?.selectAll },
    ],
  });

  if (process.platform === 'darwin') {
    template.push({
      label: labels?.window ?? 'Window',
      submenu: [
        { role: 'minimize', label: labels?.minimize },
        { role: 'close', label: labels?.close },
      ],
    });
  }

  return template;
}

export function setApplicationMenu(labels: MenuLabels | null): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate(labels)));
}
