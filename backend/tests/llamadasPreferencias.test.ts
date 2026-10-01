/**
 * Llamadas: servidores ICE con credenciales TURN temporales, "quién puede
 * llamarme", qué pasa con no molestar y el registro de calidad.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { io as clienteSocket, type Socket } from 'socket.io-client';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';

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

async function conectar(u: UsuarioDeTest): Promise<Socket> {
  const socket = clienteSocket(servidor.base, { auth: { token: u.token }, transports: ['websocket'], reconnection: false });
  abiertos.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

function esperar<T = any>(socket: Socket, evento: string, ms = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no llegó "${evento}"`)), ms);
    socket.once(evento, (p: T) => { clearTimeout(timer); resolve(p); });
  });
}

function noLlega(socket: Socket, evento: string, ms = 600): Promise<void> {
  return new Promise((resolve, reject) => {
    const fallar = () => reject(new Error(`llegó "${evento}" y no debía`));
    socket.once(evento, fallar);
    setTimeout(() => { socket.off(evento, fallar); resolve(); }, ms);
  });
}

async function directo(a: UsuarioDeTest, b: UsuarioDeTest): Promise<string> {
  const r = await pedir('/api/conversations', { method: 'POST', token: a.token, body: { type: 'direct', member_ids: [b.id] } });
  return r.datos.id;
}

function llamar(a: UsuarioDeTest, conv: string, b: UsuarioDeTest) {
  return pedir('/api/calls', {
    method: 'POST', token: a.token, body: { conversation_id: conv, type: 'voice', participant_ids: [b.id] },
  });
}

describe('servidores ICE', () => {
  test('entrega STUN y una credencial TURN firmada que vence sola', async () => {
    const u = await crearUsuario(pedir, 'ice');
    const r = await pedir('/api/calls/ice-servers', { token: u.token });
    assert.equal(r.status, 200);
    const [stun, turn] = r.datos.ice_servers;
    assert.deepEqual(stun.urls, ['stun:stun.test:3478']);
    assert.deepEqual(turn.urls, ['turn:turn.test:3478?transport=udp']);

    const [vence, userId] = turn.username.split(':');
    assert.equal(userId, u.id);
    assert.ok(Number(vence) > Date.now() / 1000);
    const esperada = crypto.createHmac('sha1', 'secreto-turn-de-la-suite').update(turn.username).digest('base64');
    assert.equal(turn.credential, esperada);
  });
});

describe('quién puede llamarme', () => {
  test('"nadie" y "contactos" cortan la llamada; agregar al contacto la habilita', async () => {
    const ana = await crearUsuario(pedir, 'priv');
    const beto = await crearUsuario(pedir, 'priv');
    const conv = await directo(ana, beto);

    await pedir('/api/notifications/settings', { method: 'PUT', token: beto.token, body: { call_privacy: 'nobody' } });
    assert.equal((await llamar(ana, conv, beto)).status, 403);

    await pedir('/api/notifications/settings', { method: 'PUT', token: beto.token, body: { call_privacy: 'contacts' } });
    assert.equal((await llamar(ana, conv, beto)).status, 403);

    assert.equal((await pedir('/api/relationships', {
      method: 'POST', token: beto.token, body: { target_user_id: ana.id, type: 'contact' },
    })).status, 201);
    assert.equal((await llamar(ana, conv, beto)).status, 201);
  });

  test('a quien te bloqueó no lo podés llamar', async () => {
    const ana = await crearUsuario(pedir, 'priv');
    const beto = await crearUsuario(pedir, 'priv');
    const conv = await directo(ana, beto);
    await pedir('/api/relationships', { method: 'POST', token: beto.token, body: { target_user_id: ana.id, type: 'blocked' } });
    assert.equal((await llamar(ana, conv, beto)).status, 403);
  });
});

describe('no molestar', () => {
  test('"rechazar como ocupado": no suena y el que llama recibe ocupado', async () => {
    const ana = await crearUsuario(pedir, 'dndc');
    const beto = await crearUsuario(pedir, 'dndc');
    const conv = await directo(ana, beto);
    await pedir('/api/notifications/settings', {
      method: 'PUT', token: beto.token, body: { dnd_enabled: true, call_dnd_behavior: 'reject' },
    });
    const [sAna, sBeto] = await Promise.all([conectar(ana), conectar(beto)]);
    const llamada = await llamar(ana, conv, beto);

    const sinTimbre = noLlega(sBeto, 'call:incoming');
    const rechazo = esperar(sAna, 'call:rejected');
    sAna.emit('call:start', { callId: llamada.datos.id });
    assert.equal((await rechazo).reason, 'busy');
    await sinTimbre;
  });

  test('"sonar en silencio": llega el timbre marcado como silencioso', async () => {
    const ana = await crearUsuario(pedir, 'dndc');
    const beto = await crearUsuario(pedir, 'dndc');
    const conv = await directo(ana, beto);
    await pedir('/api/notifications/settings', { method: 'PUT', token: beto.token, body: { dnd_enabled: true } });
    const [sAna, sBeto] = await Promise.all([conectar(ana), conectar(beto)]);
    const llamada = await llamar(ana, conv, beto);

    const timbre = esperar(sBeto, 'call:incoming');
    sAna.emit('call:start', { callId: llamada.datos.id });
    assert.equal((await timbre).silent, true);
  });
});

describe('calidad', () => {
  test('cada participante reporta su medición y queda el resumen de la llamada', async () => {
    const ana = await crearUsuario(pedir, 'qual');
    const beto = await crearUsuario(pedir, 'qual');
    const intruso = await crearUsuario(pedir, 'qual');
    const conv = await directo(ana, beto);
    const llamada = await llamar(ana, conv, beto);
    const id = llamada.datos.id;

    assert.equal((await pedir(`/api/calls/${id}/quality`, {
      method: 'POST', token: ana.token, body: { rtt_ms: 40, jitter_ms: 12, packet_loss_pct: 0.5 },
    })).status, 200);
    assert.equal((await pedir(`/api/calls/${id}/quality`, {
      method: 'POST', token: beto.token, body: { rtt_ms: 60, jitter_ms: 30, packet_loss_pct: 1.5 },
    })).status, 200);
    assert.equal((await pedir(`/api/calls/${id}/quality`, {
      method: 'POST', token: intruso.token, body: { rtt_ms: 1 },
    })).status, 403);

    const detalle = await pedir(`/api/calls/${id}`, { token: ana.token });
    const stats = detalle.datos.quality_stats;
    assert.equal(Number(stats.avg_rtt_ms), 50);
    assert.equal(Number(stats.max_jitter_ms), 30);
    assert.equal(Number(stats.avg_packet_loss_pct), 1);
  });
});
