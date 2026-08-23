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
