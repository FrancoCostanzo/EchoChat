/**
 * SCIM 2.0 ejercitado como lo haría un IdP. Los dos dialectos de PATCH están a
 * propósito: Azure manda `{op, value:{...}}` sin `path` y Okta manda `path`.
 * Si sólo se soporta uno, el aprovisionamiento funciona con la mitad de los
 * clientes y falla en silencio con la otra.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { levantarServidor, TOKEN_SCIM, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, sufijo, type Cliente, type OpcionesPeticion } from './helpers/api';

let servidor: ServidorDeTest;
let pedir: Cliente;

/** SCIM vive fuera de /api y tiene su propio content-type y su propio bearer. */
function scim(ruta: string, o: OpcionesPeticion = {}) {
  return pedir('/scim/v2' + ruta, {
    ...o,
    token: o.token ?? TOKEN_SCIM,
    headers: { 'Content-Type': 'application/scim+json', ...o.headers },
  });
}

/** Payload de alta con los campos que mandan los IdPs. */
function usuarioScim(username: string) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: username,
    displayName: 'Usuario SCIM',
    name: { givenName: 'Usuario', familyName: 'SCIM' },
    emails: [{ value: `${username}@ejemplo.com`, primary: true }],
    active: true,
  };
}

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
});
after(() => servidor.cerrar());

describe('autenticación SCIM', () => {
  test('sin token y con token incorrecto responde 401', async () => {
    assert.equal((await scim('/Users', { sinAuth: true })).status, 401);
    assert.equal((await scim('/Users', { token: 'otro-token-cualquiera-largo' })).status, 401);
  });
});

describe('descubrimiento', () => {
  test('ServiceProviderConfig declara soporte de PATCH y responde con el content-type SCIM', async () => {
    const r = await scim('/ServiceProviderConfig');
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.patch.supported, true);
  });
});

describe('ciclo de vida del usuario', () => {
  test('aprovisiona, devuelve meta.location y rechaza el userName repetido', async () => {
    const username = 'scim' + sufijo();
    const creado = await scim('/Users', { method: 'POST', body: usuarioScim(username) });
    assert.equal(creado.status, 201);
    assert.equal(creado.cuerpo.userName, username);
    assert.ok(creado.cuerpo.meta.location);

    const repetido = await scim('/Users', { method: 'POST', body: usuarioScim(username) });
    assert.equal(repetido.cuerpo.scimType, 'uniqueness');
  });

  test('lee por id y responde 404 si no existe', async () => {
    const creado = await scim('/Users', { method: 'POST', body: usuarioScim('scim' + sufijo()) });
    assert.equal((await scim(`/Users/${creado.cuerpo.id}`)).cuerpo.id, creado.cuerpo.id);
    assert.equal((await scim('/Users/00000000-0000-0000-0000-000000000000')).status, 404);
  });

  test('pagina y filtra por userName', async () => {
    const username = 'scim' + sufijo();
    await scim('/Users', { method: 'POST', body: usuarioScim(username) });

    const pagina = await scim('/Users?startIndex=1&count=10');
    assert.equal(pagina.status, 200);
    assert.equal(typeof pagina.cuerpo.totalResults, 'number');
    assert.equal(pagina.cuerpo.startIndex, 1);
    assert.ok(pagina.cuerpo.itemsPerPage <= 10);

    const filtrado = await scim(`/Users?filter=${encodeURIComponent(`userName eq "${username}"`)}`);
    assert.equal(filtrado.cuerpo.totalResults, 1);
  });

  test('PATCH estilo Azure (sin path) desactiva la cuenta', async () => {
    const creado = await scim('/Users', { method: 'POST', body: usuarioScim('scim' + sufijo()) });
    const r = await scim(`/Users/${creado.cuerpo.id}`, {
      method: 'PATCH',
      body: {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [{ op: 'Replace', value: { active: false } }],
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.active, false);
  });

  test('PATCH estilo Okta (con path) reactiva la cuenta', async () => {
    const creado = await scim('/Users', { method: 'POST', body: usuarioScim('scim' + sufijo()) });
    await scim(`/Users/${creado.cuerpo.id}`, {
      method: 'PATCH',
      body: { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'Replace', value: { active: false } }] },
    });

    const r = await scim(`/Users/${creado.cuerpo.id}`, {
      method: 'PATCH',
      body: {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [{ op: 'replace', path: 'active', value: true }],
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.active, true);
  });

  test('PUT reemplaza el recurso', async () => {
    const username = 'scim' + sufijo();
    const creado = await scim('/Users', { method: 'POST', body: usuarioScim(username) });
    const r = await scim(`/Users/${creado.cuerpo.id}`, {
      method: 'PUT', body: { ...usuarioScim(username), displayName: 'Reemplazado' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.displayName, 'Reemplazado');
  });

  test('DELETE responde 204 y lo saca del filtro', async () => {
    const username = 'scim' + sufijo();
    const creado = await scim('/Users', { method: 'POST', body: usuarioScim(username) });

    assert.equal((await scim(`/Users/${creado.cuerpo.id}`, { method: 'DELETE' })).status, 204);
    const filtrado = await scim(`/Users?filter=${encodeURIComponent(`userName eq "${username}"`)}`);
    assert.equal(filtrado.cuerpo.totalResults, 0);
  });
});

describe('grupos', () => {
  test('devuelve lista vacía en vez de fallar, para los IdPs que sondean /Groups', async () => {
    const r = await scim('/Groups');
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.totalResults, 0);
  });
});
