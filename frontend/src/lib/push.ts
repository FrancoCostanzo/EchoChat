import { notificationsApi } from '@/lib/endpoints';
import { isElectron } from '@/lib/runtimeConfig';

/**
 * Notificaciones push del navegador (Web Push) y la parte instalable de la PWA.
 *
 * La app de escritorio no usa nada de esto: tiene notificaciones nativas
 * propias y su renderer no corre en un origin http donde registrar un
 * service worker.
 */

export type PushState =
  /** El navegador no soporta push, es Electron, o el servidor no tiene claves VAPID. */
  | 'unsupported'
  /** El usuario bloqueó las notificaciones para este sitio. */
  | 'denied'
  /** Soportado, pero este navegador no está suscripto. */
  | 'off'
  | 'on';

export function isPushSupported(): boolean {
  return !isElectron()
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    // Push exige contexto seguro (https o localhost).
    && window.isSecureContext;
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registra /sw.js una sola vez. En Electron o navegadores sin soporte, null. */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return Promise.resolve(null);
  registrationPromise ??= navigator.serviceWorker
    .register('/sw.js')
    .catch(() => null);
  return registrationPromise;
}

/** La clave VAPID está en base64url; `subscribe` la quiere en bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getPublicKey(): Promise<string | null> {
  try {
    const { data } = await notificationsApi.getPushConfig();
    return data.public_key;
  } catch {
    return null;
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported() || !(await getPublicKey())) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (await getCurrentSubscription()) ? 'on' : 'off';
}

/** Pide permiso (si hace falta), suscribe este navegador y lo registra en el backend. */
export async function enablePush(): Promise<PushState> {
  const publicKey = await getPublicKey();
  const registration = await registerServiceWorker();
  if (!publicKey || !registration) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  let subscription = await registration.pushManager.getSubscription();
  // Una suscripción hecha con otra clave (el servidor cambió las VAPID) ya no sirve.
  const currentKey = subscription?.options.applicationServerKey;
  if (subscription && currentKey && btoa(String.fromCharCode(...new Uint8Array(currentKey)))
    !== btoa(String.fromCharCode(...urlBase64ToUint8Array(publicKey)))) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await notificationsApi.subscribePush(subscription.toJSON());
  return 'on';
}

export async function disablePush(): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await notificationsApi.unsubscribePush(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe();
}

/**
 * Al abrir la app con push ya activo, vuelve a mandar la suscripción: si el
 * navegador la renovó, o si este navegador lo usa otra cuenta, el backend
 * queda al día.
 */
export async function syncPushSubscription(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  const subscription = await getCurrentSubscription();
  if (subscription) await notificationsApi.subscribePush(subscription.toJSON()).catch(() => {});
}

// ── Instalación (PWA) ──────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  // Chrome/Edge lo disparan cuando la app es instalable; se guarda para
  // ofrecer el botón "Instalar" en el momento que elija el usuario.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    installListeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installListeners.forEach((fn) => fn());
  });
}

export function canInstall(): boolean {
  return installPrompt !== null;
}

export function onInstallAvailabilityChange(fn: () => void): () => void {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

export async function promptInstall(): Promise<boolean> {
  if (!installPrompt) return false;
  await installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  installListeners.forEach((fn) => fn());
  return outcome === 'accepted';
}

/** Ya corre como app instalada (ventana propia, sin barra del navegador). */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad: push sólo funciona con la app agregada a la pantalla de inicio. */
export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Contador en el ícono de la app instalada (no-op si el navegador no lo soporta). */
export function setAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) void nav.setAppBadge?.(count).catch(() => {});
  else void nav.clearAppBadge?.().catch(() => {});
}
