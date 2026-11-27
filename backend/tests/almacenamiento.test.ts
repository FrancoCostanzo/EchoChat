/**
 * Capa de almacenamiento con el driver `local`: subida, URL firmada, descarga,
 * borrado y las defensas de la ruta pública (firma, vencimiento, path traversal).
 * El adaptador S3 no se prueba acá: necesitaría un servidor S3 real.
 */
import { DIR_ALMACENAMIENTO } from './helpers/almacenamientoLocal';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'fs';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';
import { storage, LocalStorageProvider, BUCKETS, ensureBuckets } from '../src/config/storage';

let servidor: ServidorDeTest;
let pedir: Cliente;
let ana: UsuarioDeTest;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  ana = await crearUsuario(pedir, 'alm');
});
after(async () => {
  await servidor.cerrar();
  rmSync(DIR_ALMACENAMIENTO, { recursive: true, force: true });
});

/** Sube un archivo por el endpoint real (multipart) y devuelve el storage object. */
async function subir(contenido: string, nombre: string, tipo: string, objectType = 'document') {
  const form = new FormData();
  form.append('file', new Blob([contenido], { type: tipo }), nombre);
  form.append('object_type', objectType);
  const res = await fetch(`${servidor.base}/api/storage/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ana.token}` },
    body: form,
  });
  const cuerpo = (await res.json()) as { data: { id: string } };
  assert.equal(res.status, 201, JSON.stringify(cuerpo));
  return cuerpo.data;
}

async function urlFirmada(objectId: string): Promise<string> {
  const r = await pedir(`/api/storage/${objectId}/url`, { token: ana.token });
  assert.equal(r.status, 200, r.texto);
  return r.datos.url;
}

describe('almacenamiento local', () => {
  test('el driver activo es el local', () => {
    assert.equal(storage.driver, 'local');
  });

  test('subir, descargar por URL firmada y borrar', async () => {
    const obj = await subir('hola mundo', 'saludo.txt', 'text/plain');
    const url = await urlFirmada(obj.id);
    assert.match(url, /^\/api\/storage\/files\/messaging-documents\/documents\/\d{4}\/\d{2}\/.+\.txt\?exp=\d+&sig=/);

    const res = await fetch(servidor.base + url);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'hola mundo');
    assert.match(res.headers.get('content-type') ?? '', /^text\/plain/);
    assert.match(res.headers.get('content-disposition') ?? '', /^inline/);
    assert.match(res.headers.get('content-security-policy') ?? '', /sandbox/);

    const borrar = await pedir(`/api/storage/${obj.id}`, { method: 'DELETE', token: ana.token });
    assert.equal(borrar.status, 200, borrar.texto);
    assert.equal((await fetch(servidor.base + url)).status, 404);
  });

  test('un HTML subido se descarga, no se muestra en línea', async () => {
    const obj = await subir('<script>alert(1)</script>', 'pagina.html', 'text/html');
    const res = await fetch(servidor.base + await urlFirmada(obj.id));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition') ?? '', /^attachment/);
  });

  test('firma alterada o URL vencida → 403', async () => {
    const obj = await subir('secreto', 'secreto.txt', 'text/plain');
    const url = await urlFirmada(obj.id);

    const alterada = url.replace(/sig=[^&]+/, 'sig=AAAA');
    assert.equal((await fetch(servidor.base + alterada)).status, 403);

    const vencida = url.replace(/exp=\d+/, 'exp=1000');
    assert.equal((await fetch(servidor.base + vencida)).status, 403);

    // La firma de descarga no sirve para subir (cada operación firma distinto).
    const put = await fetch(servidor.base + url, { method: 'PUT', body: 'pisado' });
    assert.equal(put.status, 403);
  });

  test('no hay subida directa por API: todo pasa por /upload (antivirus + EXIF)', async () => {
    const r = await pedir('/api/storage/upload-url', {
      method: 'POST',
      token: ana.token,
      body: { original_filename: 'directo.txt', mime_type: 'text/plain', file_size_bytes: 7, object_type: 'document' },
    });
    assert.equal(r.status, 404, r.texto);
  });

  test('el driver local acepta un PUT con firma de subida', async () => {
    const bucket = 'messaging-documents';
    const objectKey = `documents/test/${Date.now()}.txt`;
    const url = await storage.getSignedUploadUrl(bucket, objectKey, 60);

    const put = await fetch(servidor.base + url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'directo' });
    assert.equal(put.status, 200);

    const get = await fetch(servidor.base + await storage.getSignedUrl(bucket, objectKey, 60));
    assert.equal(await get.text(), 'directo');
  });

  test('no se puede salir de la carpeta raíz', () => {
    const local = new LocalStorageProvider({ dir: DIR_ALMACENAMIENTO, publicUrl: '', secret: 'x' });
    assert.throws(() => local.resolvePath('messaging-images', '../../etc/passwd'));
    assert.throws(() => local.resolvePath('../afuera', 'a.txt'));
    assert.throws(() => local.resolvePath('messaging-images', 'a/./b.txt'));
    assert.throws(() => local.resolvePath('messaging-images', 'x.txt.meta.json'));
    assert.ok(local.resolvePath('messaging-images', 'images/2026/01/foto.jpg').startsWith(DIR_ALMACENAMIENTO));
  });

  test('ensureBuckets crea una carpeta por bucket', async () => {
    await ensureBuckets();
    for (const bucket of BUCKETS) assert.ok(existsSync(`${DIR_ALMACENAMIENTO}/${bucket}`), bucket);
  });
});
