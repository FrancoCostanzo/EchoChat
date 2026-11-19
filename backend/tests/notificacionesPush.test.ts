/**
 * Notificaciones push (Web Push). Ningún aviso sale a la red: se reemplaza
 * `webpush.sendNotification`, que recibe el payload en claro antes de cifrarlo,
 * y así se ve exactamente qué le llegaría al service worker.
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import webpush, { WebPushError } from 'web-push';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, sufijo, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';

interface Envio {
  endpoint: string;
  payload: any;
  ttl: number | undefined;
}

let servidor: ServidorDeTest;
let pedir: Cliente;
let envios: Envio[] = [];
/** Endpoints que el "servicio de push" da por muertos (responde 410). */
const muertos = new Set<string>();
const original = webpush.sendNotification;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  (webpush as any).sendNotification = async (sub: any, payload: string, opts: any) => {
    if (muertos.has(sub.endpoint)) {
      throw new WebPushError('gone', 410, {}, '', sub.endpoint);
    }
    envios.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), ttl: opts?.TTL });
    return { statusCode: 201, body: '', headers: {} };
  };
});
after(async () => {
  (webpush as any).sendNotification = original;
  await servidor.cerrar();
});
beforeEach(() => { envios = []; });

async function suscribir(u: UsuarioDeTest): Promise<string> {
  const endpoint = `https://push.example.test/${u.username}/${sufijo()}`;
  const r = await pedir('/api/notifications/push/subscribe', {
    method: 'POST', token: u.token,
    body: { endpoint, expirationTime: null, keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' } },
  });
  assert.equal(r.status, 201);
  // Que mande aunque el usuario figure activo: la regla "sólo si no estoy usando
  // la app" tiene su propio test.
  await pedir('/api/notifications/settings', { method: 'PUT', token: u.token, body: { push_when: 'always' } });
  return endpoint;
}

async function directo(a: UsuarioDeTest, b: UsuarioDeTest): Promise<string> {
  const r = await pedir('/api/conversations', {
    method: 'POST', token: a.token, body: { type: 'direct', member_ids: [b.id] },
  });
  return r.datos.id;
}

async function enviar(autor: UsuarioDeTest, conversationId: string, body: string): Promise<string> {
  const r = await pedir('/api/messages', {
    method: 'POST', token: autor.token, body: { conversation_id: conversationId, type: 'text', body },
  });
  assert.equal(r.status, 201);
  return r.datos.id;
}

/** Los envíos salen en segundo plano: espera a que lleguen `n` para `endpoint`. */
async function esperarEnvios(endpoint: string, n = 1, ms = 3000): Promise<Envio[]> {
  const hasta = Date.now() + ms;
  while (Date.now() < hasta) {
    const propios = envios.filter((e) => e.endpoint === endpoint);
    if (propios.length >= n) return propios;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`llegaron ${envios.filter((e) => e.endpoint === endpoint).length} envíos, se esperaban ${n}`);
}

async function ningunEnvio(endpoint: string) {
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(envios.filter((e) => e.endpoint === endpoint).length, 0);
}

describe('suscripción', () => {
  test('expone la clave pública y lista los dispositivos', async () => {
    const u = await crearUsuario(pedir, 'push');
    const config = await pedir('/api/notifications/push/config', { token: u.token });
    assert.equal(typeof config.datos.public_key, 'string');

    await suscribir(u);
    const dispositivos = await pedir('/api/notifications/push/devices', { token: u.token });
    assert.equal(dispositivos.datos.length, 1);

    const prefs = await pedir('/api/notifications/preferences', { token: u.token });
    assert.equal(prefs.datos.channels.push, true);

    assert.equal((await pedir(`/api/notifications/push/devices/${dispositivos.datos[0].id}`, {
      method: 'DELETE', token: u.token,
    })).status, 200);
    assert.equal((await pedir('/api/notifications/push/devices', { token: u.token })).datos.length, 0);
  });

  test('el envío de prueba llega a todos los dispositivos', async () => {
    const u = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(u);
    const r = await pedir('/api/notifications/push/test', { method: 'POST', token: u.token });
    assert.equal(r.datos.delivered, 1);
    const [envio] = await esperarEnvios(endpoint);
    assert.equal(envio.payload.title, 'Notificaciones activadas');
  });
});

describe('qué se manda', () => {
  test('un mensaje directo llega con remitente, texto y acciones, sin ensuciar la bandeja', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    const conv = await directo(ana, beto);

    await enviar(ana, conv, 'hola beto');
    const [envio] = await esperarEnvios(endpoint);
    assert.equal(envio.payload.title, ana.username);
    assert.equal(envio.payload.body, 'hola beto');
    assert.equal(envio.payload.url, `/chat/${conv}`);
    assert.equal(envio.payload.tag, `conv-${conv}`);
    assert.deepEqual(envio.payload.actions.map((a: any) => a.action), ['open', 'read']);
    assert.ok(envio.payload.actionToken);

    const bandeja = (await pedir('/api/notifications', { token: beto.token })).datos;
    assert.equal(bandeja.filter((n: any) => n.type === 'message').length, 0);
  });

  test('una mención sale como mención y no además como mensaje', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    const conv = await directo(ana, beto);

    await enviar(ana, conv, `mirá esto @${beto.username}`);
    const envios = await esperarEnvios(endpoint);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(envios.length, 1);
    assert.match(envios[0].payload.title, /te mencionó/);
  });

  test('la privacidad "nada" no muestra ni quién ni qué', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    await pedir('/api/notifications/settings', { method: 'PUT', token: beto.token, body: { push_preview: 'none' } });
    const conv = await directo(ana, beto);

    await enviar(ana, conv, 'secreto');
    const [envio] = await esperarEnvios(endpoint);
    assert.equal(envio.payload.title, 'EchoChat');
    assert.doesNotMatch(JSON.stringify(envio.payload), /secreto|push/);
  });

  test('con "sólo quién" no viaja el texto del mensaje', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    await pedir('/api/notifications/settings', { method: 'PUT', token: beto.token, body: { push_preview: 'sender' } });
    const conv = await directo(ana, beto);

    await enviar(ana, conv, 'contenido privado');
    const [envio] = await esperarEnvios(endpoint);
    assert.equal(envio.payload.title, ana.username);
    assert.doesNotMatch(envio.payload.body, /contenido privado/);
  });
});

describe('cuándo no se manda', () => {
  test('no molestar, chat silenciado o evento con push apagado', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    const conv = await directo(ana, beto);

    await pedir('/api/notifications/settings', { method: 'PUT', token: beto.token, body: { dnd_enabled: true } });
    await enviar(ana, conv, 'en no molestar');
    await ningunEnvio(endpoint);
    await pedir('/api/notifications/settings', { method: 'PUT', token: beto.token, body: { dnd_enabled: false } });

    await pedir(`/api/conversations/${conv}/members/${beto.id}`, {
      method: 'PUT', token: beto.token, body: { is_muted: true },
    });
    await enviar(ana, conv, 'silenciado');
    await ningunEnvio(endpoint);
    await pedir(`/api/conversations/${conv}/members/${beto.id}`, {
      method: 'PUT', token: beto.token, body: { is_muted: false },
    });

    await pedir('/api/notifications/preferences', {
      method: 'PUT', token: beto.token, body: { event_type: 'message.direct', push_enabled: false },
    });
    await enviar(ana, conv, 'push apagado');
    await ningunEnvio(endpoint);
  });

  test('"sólo si no estoy usando la app" no manda a quien está activo', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    await pedir('/api/notifications/settings', { method: 'PUT', token: beto.token, body: { push_when: 'inactive' } });
    // Activo = presencia online y actividad reciente.
    await pedir('/api/users/me/presence', { method: 'PUT', token: beto.token, body: { presence: 'online' } });
    const conv = await directo(ana, beto);

    await enviar(ana, conv, 'estás acá');
    await ningunEnvio(endpoint);
  });

  test('una suscripción que el navegador dio de baja (410) se borra', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    muertos.add(endpoint);
    const conv = await directo(ana, beto);

    await enviar(ana, conv, 'hola');
    const hasta = Date.now() + 3000;
    let dispositivos = 1;
    while (Date.now() < hasta && dispositivos > 0) {
      dispositivos = (await pedir('/api/notifications/push/devices', { token: beto.token })).datos.length;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(dispositivos, 0);
  });
});

describe('acciones desde la notificación', () => {
  test('"Marcar como leído" funciona sin sesión, sólo con el token del aviso', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    const conv = await directo(ana, beto);

    await enviar(ana, conv, 'leeme');
    const [envio] = await esperarEnvios(endpoint);
    const antes = (await pedir('/api/conversations', { token: beto.token })).datos.find((c: any) => c.id === conv);
    assert.equal(antes.unread_count, 1);

    const r = await pedir('/api/notifications/push/action', {
      method: 'POST', body: { token: envio.payload.actionToken },
    });
    assert.equal(r.status, 200);
    const despues = (await pedir('/api/conversations', { token: beto.token })).datos.find((c: any) => c.id === conv);
    assert.equal(despues.unread_count, 0);
  });

  test('un token inválido no hace nada', async () => {
    assert.equal((await pedir('/api/notifications/push/action', {
      method: 'POST', body: { token: 'no.es.valido' },
    })).status, 400);
  });

  test('el timbre de una llamada lleva Atender / Rechazar y "Rechazar" la corta', async () => {
    const ana = await crearUsuario(pedir, 'push');
    const beto = await crearUsuario(pedir, 'push');
    const endpoint = await suscribir(beto);
    const conv = await directo(ana, beto);
    const llamada = await pedir('/api/calls', {
      method: 'POST', token: ana.token, body: { conversation_id: conv, type: 'video', participant_ids: [beto.id] },
    });
    const callId = llamada.datos.id;

    // El timbre sale por socket; el push del timbre lo dispara el mismo handler.
    const { io } = await import('socket.io-client');
    const socket = io(servidor.base, { auth: { token: ana.token }, transports: ['websocket'], reconnection: false });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      socket.emit('call:start', { callId });
      const [envio] = await esperarEnvios(endpoint);
      assert.match(envio.payload.title, /Videollamada de/);
      assert.equal(envio.payload.requireInteraction, true);
      assert.equal(envio.ttl, 35);
      assert.deepEqual(envio.payload.actions.map((a: any) => a.action), ['answer', 'decline']);

      const rechazo = new Promise<any>((resolve) => socket.once('call:rejected', resolve));
      assert.equal((await pedir('/api/notifications/push/action', {
        method: 'POST', body: { token: envio.payload.actionToken },
      })).status, 200);
      const evento = await rechazo;
      assert.equal(evento.userId, beto.id);
    } finally {
      socket.disconnect();
    }
  });
});
