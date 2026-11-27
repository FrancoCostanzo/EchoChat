/**
 * Borrar un mensaje con adjuntos: el archivo y su fila en `storage_objects` se
 * van juntos, salvo que otro mensaje (un reenvío) siga usando el objeto.
 * Antes la fila quedaba huérfana: el archivo se borraba del bucket, pero
 * `deleteAttachments` buscaba los objetos después de haber soltado los adjuntos.
 */
import { DIR_ALMACENAMIENTO } from './helpers/almacenamientoLocal';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'fs';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';
import { db } from '../src/config/db';
import { LocalStorageProvider, storage } from '../src/config/storage';

let servidor: ServidorDeTest;
let pedir: Cliente;
let ana: UsuarioDeTest;
let beto: UsuarioDeTest;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  ana = await crearUsuario(pedir, 'adj');
  beto = await crearUsuario(pedir, 'adj');
});
after(async () => {
  await servidor.cerrar();
  rmSync(DIR_ALMACENAMIENTO, { recursive: true, force: true });
});

async function conversacion(): Promise<string> {
  const r = await pedir('/api/conversations', {
    method: 'POST', token: ana.token, body: { type: 'direct', member_ids: [beto.id] },
  });
  assert.ok([200, 201].includes(r.status), r.texto);
  return r.datos.id;
}

async function grupo(): Promise<string> {
  const r = await pedir('/api/conversations', {
    method: 'POST', token: ana.token, body: { type: 'group', name: 'Adjuntos', member_ids: [beto.id] },
  });
  assert.equal(r.status, 201, r.texto);
  return r.datos.id;
}

/** Sube un archivo y lo manda como mensaje. Devuelve el mensaje y el objeto. */
async function mandarAdjunto(conversationId: string) {
  const form = new FormData();
  form.append('file', new Blob(['contenido'], { type: 'text/plain' }), 'adjunto.txt');
  form.append('object_type', 'document');
  const subida = await fetch(`${servidor.base}/api/storage/upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${ana.token}` }, body: form,
  });
  assert.equal(subida.status, 201);
  const objeto = ((await subida.json()) as { data: { id: string; bucket_name: string; object_key: string } }).data;
  const r = await pedir('/api/messages', {
    method: 'POST', token: ana.token, body: { conversation_id: conversationId, type: 'media', attachment_ids: [objeto.id] },
  });
  assert.equal(r.status, 201, r.texto);
  return { mensajeId: r.datos.id as string, objeto };
}

async function filaDelObjeto(id: string) {
  return db.selectFrom('storage_objects').select('id').where('id', '=', id).executeTakeFirst();
}

function archivoEnDisco(bucket: string, key: string): boolean {
  return existsSync((storage as LocalStorageProvider).resolvePath(bucket, key));
}

describe('borrar mensajes con adjuntos', () => {
  test('borra el archivo y su fila de storage_objects', async () => {
    const { mensajeId, objeto } = await mandarAdjunto(await conversacion());
    assert.ok(archivoEnDisco(objeto.bucket_name, objeto.object_key));

    const r = await pedir(`/api/messages/${mensajeId}`, { method: 'DELETE', token: ana.token });
    assert.equal(r.status, 200, r.texto);

    assert.equal(await filaDelObjeto(objeto.id), undefined);
    assert.equal(archivoEnDisco(objeto.bucket_name, objeto.object_key), false);
  });

  test('si un reenvío usa el mismo objeto, se conserva', async () => {
    const { mensajeId, objeto } = await mandarAdjunto(await conversacion());
    const reenvio = await pedir(`/api/messages/${mensajeId}/forward`, {
      method: 'POST', token: ana.token, body: { conversation_ids: [await grupo()] },
    });
    assert.ok([200, 201].includes(reenvio.status), reenvio.texto);

    const r = await pedir(`/api/messages/${mensajeId}`, { method: 'DELETE', token: ana.token });
    assert.equal(r.status, 200, r.texto);

    assert.ok(await filaDelObjeto(objeto.id), 'el reenvío se quedó sin su storage object');
    assert.ok(archivoEnDisco(objeto.bucket_name, objeto.object_key), 'el reenvío se quedó sin el archivo');
  });
});
