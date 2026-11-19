/**
 * Preferencias de notificación (global, por evento y por chat) y el despachador
 * que las aplica. Lo observable es si la notificación queda en la bandeja y si
 * el aviso en tiempo real sale marcado como silencioso.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { io as clienteSocket, type Socket } from 'socket.io-client';
import { levantarServidor, ADMIN, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { crearUsuario, iniciarSesion, type UsuarioDeTest } from './helpers/usuarios';

let servidor: ServidorDeTest;
let pedir: Cliente;
const abiertos: Socket[] = [];

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
});
after(async () => {
  for (const s of abiertos) s.disconnect();
  await servidor.cerrar();
});

async function directo(a: UsuarioDeTest, b: UsuarioDeTest): Promise<string> {
  const r = await pedir('/api/conversations', {
    method: 'POST', token: a.token, body: { type: 'direct', member_ids: [b.id] },
  });
  assert.equal(r.status, 201);
  return r.datos.id;
}

async function enviar(autor: UsuarioDeTest, conversationId: string, body: string, extra: object = {}) {
  const r = await pedir('/api/messages', {
    method: 'POST', token: autor.token, body: { conversation_id: conversationId, type: 'text', body, ...extra },
  });
  assert.equal(r.status, 201);
  return r.datos.id as string;
}

async function bandeja(usuario: UsuarioDeTest): Promise<any[]> {
  return (await pedir('/api/notifications?limit=50', { token: usuario.token })).datos;
}

/** Las notificaciones salen en segundo plano: se espera a que aparezca la de `tipo`. */
async function esperarEnBandeja(usuario: UsuarioDeTest, tipo: string, ms = 3000): Promise<any> {
  const hasta = Date.now() + ms;
  while (Date.now() < hasta) {
    const hallada = (await bandeja(usuario)).find((n) => n.type === tipo);
    if (hallada) return hallada;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no llegó una notificación "${tipo}"`);
}

/** Da tiempo a que el envío en segundo plano termine y comprueba que no haya de `tipo`. */
async function sinNotificacion(usuario: UsuarioDeTest, tipo: string) {
  await new Promise((r) => setTimeout(r, 600));
  assert.equal((await bandeja(usuario)).filter((n) => n.type === tipo).length, 0);
}

async function conectar(usuario: UsuarioDeTest): Promise<Socket> {
  const socket = clienteSocket(servidor.base, {
    auth: { token: usuario.token }, transports: ['websocket'], reconnection: false,
  });
  abiertos.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

describe('configuración global', () => {
  test('arranca con los valores por defecto y guarda sólo lo que se cambia', async () => {
    const u = await crearUsuario(pedir, 'nset');
    const inicial = await pedir('/api/notifications/settings', { token: u.token });
    assert.equal(inicial.status, 200);
    assert.equal(inicial.datos.dnd_enabled, false);
    assert.equal(inicial.datos.sound_name, 'ping');

    const cambio = await pedir('/api/notifications/settings', {
      method: 'PUT', token: u.token,
      body: { quiet_hours_start: '22:00', quiet_hours_end: '07:30', quiet_days: [0, 6], sound_volume: 40 },
    });
    assert.equal(cambio.status, 200);
    assert.deepEqual(cambio.datos.quiet_days, [0, 6]);
    assert.equal(cambio.datos.sound_volume, 40);
    assert.equal(cambio.datos.sound_name, 'ping');

    assert.equal((await pedir('/api/notifications/settings', {
      method: 'PUT', token: u.token, body: { quiet_hours_start: '25:00' },
    })).status, 400);
  });

  test('apagar el no molestar borra su vencimiento', async () => {
    const u = await crearUsuario(pedir, 'nset');
    await pedir('/api/notifications/settings', {
      method: 'PUT', token: u.token, body: { dnd_enabled: true, dnd_until: new Date(Date.now() + 3600_000).toISOString() },
    });
    const apagado = await pedir('/api/notifications/settings', {
      method: 'PUT', token: u.token, body: { dnd_enabled: false },
    });
    assert.equal(apagado.datos.dnd_until, null);
  });
});

describe('preferencias por evento', () => {
  test('devuelve la matriz completa y no deja tocar un evento bloqueado', async () => {
    const u = await crearUsuario(pedir, 'npref');
    const prefs = await pedir('/api/notifications/preferences', { token: u.token });
    const eventos = prefs.datos.events.map((e: any) => e.event_type);
    assert.ok(eventos.includes('message.mention'));
    assert.ok(eventos.includes('call.missed'));
    assert.equal(prefs.datos.events.find((e: any) => e.event_type === 'security.alert').locked, true);

    assert.equal((await pedir('/api/notifications/preferences', {
      method: 'PUT', token: u.token, body: { event_type: 'security.alert', email_enabled: false },
    })).status, 403);
    assert.equal((await pedir('/api/notifications/preferences', {
      method: 'PUT', token: u.token, body: { event_type: 'inventado', push_enabled: false },
    })).status, 400);

    const cambio = await pedir('/api/notifications/preferences', {
      method: 'PUT', token: u.token, body: { event_type: 'message.reaction', in_app_enabled: false },
    });
    assert.equal(cambio.status, 200);
    assert.equal(cambio.datos.in_app_enabled, false);
  });

  test('con el evento apagado no queda notificación', async () => {
    const ana = await crearUsuario(pedir, 'npref');
    const beto = await crearUsuario(pedir, 'npref');
    const conv = await directo(ana, beto);
    await pedir('/api/notifications/preferences', {
      method: 'PUT', token: beto.token, body: { event_type: 'message.mention', in_app_enabled: false },
    });
    await enviar(ana, conv, `hola @${beto.username}`);
    await sinNotificacion(beto, 'mention');
  });

  test('los defaults del admin aplican a quien no cambió nada', async () => {
    const admin = await iniciarSesion(pedir, ADMIN.username, ADMIN.password);
    const u = await crearUsuario(pedir, 'npref');
    try {
      assert.equal((await pedir('/api/admin/settings/notification_defaults', {
        method: 'PUT', token: admin.token, body: { value: { 'message.group': { push: false } } },
      })).status, 200);
      const prefs = await pedir('/api/notifications/preferences', { token: u.token });
      const grupo = prefs.datos.events.find((e: any) => e.event_type === 'message.group');
      assert.equal(grupo.push_enabled, false);
      assert.equal(grupo.in_app_enabled, true);
    } finally {
      await pedir('/api/admin/settings/notification_defaults', {
        method: 'PUT', token: admin.token, body: { value: {} },
      });
    }
  });
});

describe('silencio por chat', () => {
  test('silenciado deja pasar menciones; nivel "nada" las corta', async () => {
    const ana = await crearUsuario(pedir, 'nchat');
    const beto = await crearUsuario(pedir, 'nchat');
    const conv = await directo(ana, beto);

    await pedir(`/api/conversations/${conv}/members/${beto.id}`, {
      method: 'PUT', token: beto.token, body: { is_muted: true },
    });
    await enviar(ana, conv, `che @${beto.username}`);
    await esperarEnBandeja(beto, 'mention');

    const nivel = await pedir(`/api/conversations/${conv}/members/${beto.id}`, {
      method: 'PUT', token: beto.token, body: { notification_level: 'none' },
    });
    assert.equal(nivel.status, 200);
    await pedir('/api/notifications/read-all', { method: 'POST', token: beto.token });
    const antes = (await bandeja(beto)).length;
    await enviar(ana, conv, `otra vez @${beto.username}`);
    await new Promise((r) => setTimeout(r, 600));
    assert.equal((await bandeja(beto)).length, antes);

    const lista = await pedir('/api/conversations', { token: beto.token });
    const fila = lista.datos.find((c: any) => c.id === conv);
    assert.equal(fila.notification_level, 'none');
  });
});

describe('no molestar', () => {
  test('la notificación se guarda pero el aviso en vivo sale silencioso', async () => {
    const ana = await crearUsuario(pedir, 'ndnd');
    const beto = await crearUsuario(pedir, 'ndnd');
    const conv = await directo(ana, beto);
    await pedir('/api/notifications/settings', {
      method: 'PUT', token: beto.token, body: { dnd_enabled: true },
    });
    const socket = await conectar(beto);
    const aviso = new Promise<any>((resolve) => socket.once('notification:new', resolve));

    await enviar(ana, conv, `urgente @${beto.username}`);
    const evento = await aviso;
    assert.equal(evento.type, 'mention');
    assert.equal(evento.silent, true);
    await esperarEnBandeja(beto, 'mention');
  });
});

describe('eventos nuevos', () => {
  test('una respuesta en un hilo avisa al autor de la raíz', async () => {
    const ana = await crearUsuario(pedir, 'nhilo');
    const beto = await crearUsuario(pedir, 'nhilo');
    const conv = await directo(ana, beto);
    const raiz = await enviar(ana, conv, 'pregunta');
    await enviar(beto, conv, 'respuesta', { thread_id: raiz });
    const n = await esperarEnBandeja(ana, 'thread');
    assert.equal(n.reference_data.thread_id, raiz);
  });

  test('una reacción avisa al autor, y la propia no', async () => {
    const ana = await crearUsuario(pedir, 'nreac');
    const beto = await crearUsuario(pedir, 'nreac');
    const conv = await directo(ana, beto);
    const mensaje = await enviar(ana, conv, 'reaccioná');

    await pedir(`/api/messages/${mensaje}/reactions`, { method: 'POST', token: ana.token, body: { emoji: '👍' } });
    await sinNotificacion(ana, 'reaction');

    await pedir(`/api/messages/${mensaje}/reactions`, { method: 'POST', token: beto.token, body: { emoji: '🎉' } });
    const n = await esperarEnBandeja(ana, 'reaction');
    assert.match(n.title, /🎉/);
  });

  test('una llamada perdida avisa a quien no atendió', async () => {
    const ana = await crearUsuario(pedir, 'ncall');
    const beto = await crearUsuario(pedir, 'ncall');
    const conv = await directo(ana, beto);
    const llamada = await pedir('/api/calls', {
      method: 'POST', token: ana.token, body: { conversation_id: conv, type: 'voice', participant_ids: [beto.id] },
    });
    await pedir(`/api/calls/${llamada.datos.id}/status`, {
      method: 'PUT', token: ana.token, body: { status: 'missed', end_reason: 'no_answer' },
    });
    const n = await esperarEnBandeja(beto, 'call');
    assert.equal(n.reference_id, llamada.datos.id);
    await sinNotificacion(ana, 'call');
  });
});
