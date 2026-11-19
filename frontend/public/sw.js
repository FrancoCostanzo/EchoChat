/*
 * Service worker de EchoChat: recibe las notificaciones push y maneja sus
 * botones. No cachea la app (no hay modo offline): sólo existe para que el
 * navegador pueda avisar con la pestaña cerrada y para que la app sea instalable.
 *
 * El payload lo arma backend/src/services/push.service.ts (PushPayload).
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'EchoChat', body: event.data ? event.data.text() : '' };
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Mismo tag = reemplaza al aviso anterior (un aviso por chat, no veinte).
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    requireInteraction: Boolean(data.requireInteraction),
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
    data: { url: data.url || '/', actionToken: data.actionToken || null },
  };

  event.waitUntil(self.registration.showNotification(data.title || 'EchoChat', options));
});

/** Enfoca una pestaña de la app (navegándola a `url`) o abre una nueva. */
async function openApp(url) {
  const target = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
  if (existing) {
    await existing.focus();
    // La navegación la hace la app (react-router), sin recargar la página.
    existing.postMessage({ type: 'echochat:navigate', url });
    return;
  }
  await self.clients.openWindow(target);
}

/** Ejecuta una acción sin abrir la app, con el token firmado que trajo el aviso. */
async function runAction(token) {
  if (!token) return;
  try {
    await fetch('/api/notifications/push/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Sin red: no hay mucho más que hacer desde acá.
  }
}

self.addEventListener('notificationclick', (event) => {
  const { url, actionToken } = event.notification.data || {};
  event.notification.close();

  if (event.action === 'read' || event.action === 'decline') {
    event.waitUntil(runAction(actionToken));
    return;
  }
  // "Atender" abre la llamada: la app la acepta sola al ver `?call=` en la URL.
  const destination = event.action === 'answer' ? `${url}${url.includes('?') ? '&' : '?'}answer=1` : url;
  event.waitUntil(openApp(destination || '/'));
});

// Si el navegador renueva la suscripción por su cuenta, la app la vuelve a
// registrar en el backend la próxima vez que se abre (ver lib/push.ts).
