import type { MenuLabels, NotificationOptions, ShareSource, SsoResult, TrayLabels } from '@/types/electron';

/**
 * Fachada de las funciones exclusivas de escritorio.
 *
 * Todas son no-op en la web, así que el resto del código las puede llamar sin
 * preguntar por el entorno. La detección puntual (`isElectron()`) sigue estando
 * en `lib/runtimeConfig.ts` para cuando hay que decidir *qué* renderizar.
 */

/** Notificación nativa del SO. En la web no hace nada (todavía no hay web push). */
export function showDesktopNotification(options: NotificationOptions): void {
  window.electronAPI?.showNotification(options);
}

/** Contador de no leídos en la barra de tareas / dock. */
export function setDesktopBadge(count: number, description: string): void {
  window.electronAPI?.setBadgeCount(count, description);
}

export function setDesktopTrayLabels(labels: TrayLabels): void {
  window.electronAPI?.setTrayLabels(labels);
}

export function setDesktopMenuLabels(labels: MenuLabels): void {
  window.electronAPI?.setMenuLabels(labels);
}

/**
 * Si el usuario está mirando la app.
 *
 * En la web alcanza con `document.hidden`. En Electron no: `document.hidden`
 * sólo es true con la ventana minimizada, no cuando está detrás de otra
 * ventana — que es justamente el caso en el que hay que notificar. Por eso el
 * main manda el foco real y acá se cachea.
 */
let electronFocused = true;

export function isAppFocused(): boolean {
  if (window.electronAPI) return electronFocused;
  return !document.hidden;
}

/**
 * Arranca el seguimiento del foco de la ventana. Devuelve la función de
 * limpieza. No-op en la web.
 */
export function watchWindowFocus(): () => void {
  const api = window.electronAPI;
  if (!api) return () => {};

  void api.isWindowFocused().then((focused) => { electronFocused = focused; });
  return api.onWindowFocusChange((focused) => { electronFocused = focused; });
}

/** Click en una notificación nativa. Devuelve la función de limpieza. */
export function onOpenConversation(callback: (conversationId: string) => void): () => void {
  return window.electronAPI?.onOpenConversation(callback) ?? (() => {});
}

/**
 * Aviso de que ya se descargó una versión nueva y falta reiniciar. Devuelve la
 * función de limpieza. En la web no pasa nunca.
 */
export function onUpdateReady(callback: (version: string) => void): () => void {
  return window.electronAPI?.onUpdateReady(callback) ?? (() => {});
}

export function restartToUpdate(): void {
  window.electronAPI?.restartToUpdate();
}

/**
 * Abre el login SSO en el navegador del sistema. Devuelve false si no estamos
 * en Electron o si el main rechazó el pedido — el caller decide el fallback.
 */
export async function openSsoLogin(provider: string): Promise<boolean> {
  return (await window.electronAPI?.openSsoLogin(provider)) ?? false;
}

/** Resultado del SSO, que vuelve por deep link. Devuelve la función de limpieza. */
export function onSsoResult(callback: (result: SsoResult) => void): () => void {
  return window.electronAPI?.onSsoResult(callback) ?? (() => {});
}

/** Pedido de selector de pantalla. Devuelve la función de limpieza. */
export function onScreenPickRequest(callback: (sources: ShareSource[]) => void): () => void {
  return window.electronAPI?.onScreenPickRequest(callback) ?? (() => {});
}

export function respondScreenPick(sourceId: string | null): void {
  window.electronAPI?.respondScreenPick(sourceId);
}
