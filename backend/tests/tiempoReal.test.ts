/**
 * El bus de eventos, que es lo que reemplazó a los `require('../socket').getIO()`
 * perezosos dentro de las funciones. Los servicios ya no conocen Socket.IO:
 * publican en `config/eventBus` y `socket.ts` es el único que empuja a los
 * clientes. Si esa suscripción se rompe, nada falla al compilar ni en HTTP —
 * simplemente los mensajes dejan de llegar en tiempo real.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
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

/** Conecta un cliente de sockets autenticado y espera al `connect`. */
async function conectar(usuario: UsuarioDeTest): Promise<Socket> {
  const socket = clienteSocket(servidor.base, {
    auth: { token: usuario.token },
    transports: ['websocket'],
    reconnection: false,
  });
  abiertos.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

/** Espera un evento con tope de tiempo, para que un fallo no cuelgue la suite. */
function esperarEvento<T = any>(socket: Socket, evento: string, ms = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(
      () => reject(new Error(`no llegó "${evento}" en ${ms} ms`)),
      ms,
    );
    socket.once(evento, (payload: T) => {
      clearTimeout(temporizador);
      resolve(payload);
    });
  });
}

/** Resuelve si el evento NO llega en `ms`; falla si llega. */
function noLlega(socket: Socket, evento: string, ms = 600): Promise<void> {
  return new Promise((resolve, reject) => {
    const alLlegar = () => reject(new Error(`llegó "${evento}" y no debía`));
    socket.once(evento, alLlegar);
    setTimeout(() => {
      socket.off(evento, alLlegar);
      resolve();
    }, ms);
  });
}

describe('señalización de llamadas', () => {
  async function llamadaEntre(ana: UsuarioDeTest, beto: UsuarioDeTest): Promise<string> {
    const conv = await pedir('/api/conversations', {
      method: 'POST', token: ana.token, body: { type: 'direct', member_ids: [beto.id] },
    });
    const llamada = await pedir('/api/calls', {
      method: 'POST', token: ana.token,
      body: { conversation_id: conv.datos.id, type: 'voice', participant_ids: [beto.id] },
    });
    assert.equal(llamada.status, 201);
    return llamada.datos.id;
  }

  test('al conectarse le vuelven a sonar las llamadas pendientes', async () => {
    const ana = await crearUsuario(pedir, 'call');
    const beto = await crearUsuario(pedir, 'call');
    const callId = await llamadaEntre(ana, beto);

    const socketBeto = clienteSocket(servidor.base, {
      auth: { token: beto.token }, transports: ['websocket'], reconnection: false,
    });
    abiertos.push(socketBeto);
    const timbre = await esperarEvento(socketBeto, 'call:incoming');
    assert.equal(timbre.callId, callId);
    assert.equal(timbre.from.id, ana.id);
  });

  test('el timbre sale con los datos del servidor, no con los del cliente', async () => {
    const ana = await crearUsuario(pedir, 'call');
    const beto = await crearUsuario(pedir, 'call');
    const callId = await llamadaEntre(ana, beto);
    const [socketAna, socketBeto] = await Promise.all([conectar(ana), conectar(beto)]);

    const llegada = esperarEvento(socketBeto, 'call:incoming');
    socketAna.emit('call:start', {
      callId, calleeIds: [beto.id], from: { id: 'otro', display_name: 'El jefe' },
    });

    const timbre = await llegada;
    assert.equal(timbre.callId, callId);
    assert.equal(timbre.from.id, ana.id);
    assert.notEqual(timbre.from.display_name, 'El jefe');
  });

  test('alguien ajeno no puede timbrar, entrar ni mandar señalización', async () => {
    const ana = await crearUsuario(pedir, 'call');
    const beto = await crearUsuario(pedir, 'call');
    const intruso = await crearUsuario(pedir, 'call');
    // Conectados antes de crear la llamada: al conectarse, el servidor reenvía
    // los timbres pendientes, y acá se prueba sólo el `call:start`.
    const [socketAna, socketBeto, socketIntruso] = await Promise.all([
      conectar(ana), conectar(beto), conectar(intruso),
    ]);
    const callId = await llamadaEntre(ana, beto);

    // Timbrar en nombre de una llamada ajena, o a cualquiera.
    const sinTimbre = noLlega(socketBeto, 'call:incoming');
    socketIntruso.emit('call:start', { callId, calleeIds: [beto.id], from: { id: ana.id } });
    await sinTimbre;

    // Ana timbra de verdad; el intruso intenta aceptar y mandar SDP.
    const timbre = esperarEvento(socketBeto, 'call:incoming');
    socketAna.emit('call:start', { callId });
    await timbre;

    const sinIngreso = noLlega(socketAna, 'call:peer-joined');
    const sinSenal = noLlega(socketBeto, 'call:signal');
    socketIntruso.emit('call:accept', { callId });
    socketIntruso.emit('call:signal', { callId, to: beto.id, data: { sdp: 'x' } });
    await Promise.all([sinIngreso, sinSenal]);

    // Beto sí entra.
    const ingreso = esperarEvento(socketAna, 'call:peer-joined');
    socketBeto.emit('call:accept', { callId });
    assert.equal((await ingreso).userId, beto.id);
  });
});

describe('bus de eventos', () => {
  test('el handshake rechaza una conexión sin token válido', async () => {
    const socket = clienteSocket(servidor.base, {
      auth: { token: 'no.es.un.jwt' },
      transports: ['websocket'],
      reconnection: false,
    });
    abiertos.push(socket);
    const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    assert.match(error.message, /token|auth/i);
  });

  test('toConversation: un mensaje nuevo le llega al otro miembro', async () => {
    const ana = await crearUsuario(pedir, 'rt');
    const beto = await crearUsuario(pedir, 'rt');
    const conv = await pedir('/api/conversations', {
      method: 'POST', token: ana.token, body: { type: 'direct', member_ids: [beto.id] },
    });

    // Beto se conecta después de existir la conversación, así entra a la sala.
    const socketBeto = await conectar(beto);
    const llegada = esperarEvento(socketBeto, 'message:new');

    const texto = 'mensaje por el bus';
    await pedir('/api/messages', {
      method: 'POST', token: ana.token,
      body: { conversation_id: conv.datos.id, type: 'text', body: texto },
    });

    const evento = await llegada;
    assert.equal(evento.body, texto);
    assert.equal(evento.conversation_id, conv.datos.id);
  });

  test('toConversation: una reacción llega al otro miembro', async () => {
    const ana = await crearUsuario(pedir, 'rt');
    const beto = await crearUsuario(pedir, 'rt');
    const conv = await pedir('/api/conversations', {
      method: 'POST', token: ana.token, body: { type: 'direct', member_ids: [beto.id] },
    });
    const mensaje = await pedir('/api/messages', {
      method: 'POST', token: ana.token,
      body: { conversation_id: conv.datos.id, type: 'text', body: 'para reaccionar' },
    });

    const socketAna = await conectar(ana);
    const llegada = esperarEvento(socketAna, 'message:reaction');

    await pedir(`/api/messages/${mensaje.datos.id}/reactions`, {
      method: 'POST', token: beto.token, body: { emoji: '🎉' },
    });

    const evento = await llegada;
    assert.equal(evento.messageId ?? evento.message_id, mensaje.datos.id);
  });

  test('toAll: un cambio de presencia se difunde a todos', async () => {
    const ana = await crearUsuario(pedir, 'rt');
    const beto = await crearUsuario(pedir, 'rt');
    const socketBeto = await conectar(beto);

    // La conexión de Beto ya emitió su propia presencia; se espera la de Ana.
    const llegada = new Promise<any>((resolve, reject) => {
      const temporizador = setTimeout(() => reject(new Error('no llegó presence:changed de Ana')), 5000);
      socketBeto.on('presence:changed', (p: any) => {
        if (p.userId === ana.id && p.presence === 'busy') {
          clearTimeout(temporizador);
          resolve(p);
        }
      });
    });

    await pedir('/api/users/me/presence', { method: 'PUT', token: ana.token, body: { presence: 'busy' } });

    const evento = await llegada;
    assert.equal(evento.userId, ana.id);
    assert.equal(evento.presence, 'busy');
  });
});
