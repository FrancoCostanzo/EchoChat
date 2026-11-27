/** Mensajes de ubicación y de contacto (Fase 8.6 y 8.7). */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';

let servidor: ServidorDeTest;
let pedir: Cliente;
let ana: UsuarioDeTest;
let beto: UsuarioDeTest;
let carla: UsuarioDeTest;
let conv: string;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  ana = await crearUsuario(pedir, 'tip');
  beto = await crearUsuario(pedir, 'tip');
  carla = await crearUsuario(pedir, 'tip');
  const r = await pedir('/api/conversations', {
    method: 'POST', token: ana.token, body: { type: 'direct', member_ids: [beto.id] },
  });
  assert.ok([200, 201].includes(r.status), r.texto);
  conv = r.datos.id;
});
after(() => servidor.cerrar());

function mandar(body: Record<string, unknown>) {
  return pedir('/api/messages', { method: 'POST', token: ana.token, body: { conversation_id: conv, ...body } });
}

describe('ubicación', () => {
  test('guarda las coordenadas y usa la etiqueta como cuerpo', async () => {
    const r = await mandar({ type: 'location', metadata: { lat: -34.6037, lng: -58.3816, label: 'Oficina central' } });
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.datos.type, 'location');
    assert.equal(r.datos.body, 'Oficina central');
    assert.equal(r.datos.metadata.lat, -34.6037);
    assert.equal(r.datos.metadata.lng, -58.3816);
  });

  test('sin etiqueta, el cuerpo son las coordenadas', async () => {
    const r = await mandar({ type: 'location', metadata: { lat: 10, lng: 20 } });
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.datos.body, '10.00000, 20.00000');
  });

  test('coordenadas fuera de rango o faltantes → 400', async () => {
    assert.equal((await mandar({ type: 'location', metadata: { lat: 91, lng: 0 } })).status, 400);
    assert.equal((await mandar({ type: 'location', metadata: { lat: 0 } })).status, 400);
    assert.equal((await mandar({ type: 'location' })).status, 400);
  });
});

describe('contacto', () => {
  test('comparte un usuario y el cuerpo es su nombre', async () => {
    const r = await mandar({ type: 'contact', metadata: { user_id: carla.id } });
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.datos.type, 'contact');
    assert.equal(r.datos.body, carla.username);
    assert.deepEqual(r.datos.metadata, { user_id: carla.id });
  });

  test('un usuario que no existe → 400', async () => {
    const r = await mandar({ type: 'contact', metadata: { user_id: '00000000-0000-4000-8000-000000000000' } });
    assert.equal(r.status, 400, r.texto);
  });

  test('descarta los datos extra de metadata (no se duplica PII)', async () => {
    const r = await mandar({ type: 'contact', metadata: { user_id: carla.id, email: 'falso@x.com' } });
    assert.equal(r.status, 201, r.texto);
    assert.deepEqual(r.datos.metadata, { user_id: carla.id });
  });
});
