/**
 * Vista previa de links (Fase 8.5). La página la sirve un servidor HTTP local en
 * 127.0.0.1, así que para leerla hay que permitir IPs privadas; con la opción por
 * defecto el mismo link tiene que quedar bloqueado (guarda anti-SSRF).
 */
import { after, afterEach, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import type { AddressInfo } from 'net';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';
import config from '../src/config';
import { db } from '../src/config/db';
import linkPreviewService, { firstUrl, isPrivateAddress, parseHtml } from '../src/services/linkPreview.service';

const PAGINA = `<!doctype html><html><head>
  <title>Título de respaldo</title>
  <meta property="og:title" content="Informe &amp; resultados">
  <meta property="og:description" content='Resumen del trimestre'>
  <meta property="og:image" content="https://cdn.example.com/portada.png">
  <meta property="og:site_name" content="Intranet">
</head><body>hola</body></html>`;

let servidor: ServidorDeTest;
let pedir: Cliente;
let ana: UsuarioDeTest;
let beto: UsuarioDeTest;
let web: http.Server;
let base: string;
const original = { ...config.linkPreview };

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  ana = await crearUsuario(pedir, 'lnk');
  beto = await crearUsuario(pedir, 'lnk');

  web = http.createServer((req, res) => {
    if (req.url === '/redirige') {
      res.writeHead(302, { Location: '/pagina' });
      return res.end();
    }
    if (req.url === '/otra') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<title>Otra página</title>');
    }
    if (req.url === '/archivo') {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      return res.end('%PDF');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGINA);
  });
  await new Promise<void>((r) => web.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`;
});
after(async () => {
  Object.assign(config.linkPreview, original);
  await new Promise((r) => web.close(r));
  await servidor.cerrar();
});
afterEach(() => {
  Object.assign(config.linkPreview, original);
  linkPreviewService.clearCache();
});

async function conversacion(): Promise<string> {
  const r = await pedir('/api/conversations', {
    method: 'POST', token: ana.token, body: { type: 'group', name: 'Links', member_ids: [beto.id] },
  });
  assert.equal(r.status, 201, r.texto);
  return r.datos.id;
}

async function mandar(conv: string, body: string): Promise<string> {
  const r = await pedir('/api/messages', {
    method: 'POST', token: ana.token, body: { conversation_id: conv, type: 'text', body },
  });
  assert.equal(r.status, 201, r.texto);
  return r.datos.id;
}

/** La vista previa se busca en segundo plano: espera hasta que aparezca (o no). */
async function vistaPrevia(messageId: string, esperarMs = 2000) {
  const hasta = Date.now() + esperarMs;
  for (;;) {
    const r = await pedir(`/api/messages/${messageId}`, { token: beto.token });
    assert.equal(r.status, 200, r.texto);
    if (r.datos.link_preview || Date.now() > hasta) return r.datos.link_preview;
    await new Promise((res) => setTimeout(res, 50));
  }
}

describe('lectura de la página', () => {
  test('toma Open Graph, decodifica entidades y resuelve la imagen', () => {
    const p = parseHtml(PAGINA, 'https://intranet.example.com/informe');
    assert.deepEqual(p, {
      url: 'https://intranet.example.com/informe',
      title: 'Informe & resultados',
      description: 'Resumen del trimestre',
      image_url: 'https://cdn.example.com/portada.png',
      site_name: 'Intranet',
    });
  });

  test('sin Open Graph usa <title>; una imagen http se descarta', () => {
    const p = parseHtml('<title> Hola  mundo </title><meta property="og:image" content="http://x.com/a.png">', 'https://www.ejemplo.com/');
    assert.equal(p?.title, 'Hola mundo');
    assert.equal(p?.image_url, null);
    assert.equal(p?.site_name, 'ejemplo.com');
  });

  test('una página sin título ni descripción no da vista previa', () => {
    assert.equal(parseHtml('<p>nada</p>', 'https://a.com'), null);
  });

  test('la URL no se lleva la puntuación de la oración', () => {
    assert.equal(firstUrl('mirá https://a.com/x?y=1. ¿Viste?'), 'https://a.com/x?y=1');
    assert.equal(firstUrl('sin links'), null);
  });

  test('rangos privados', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
      assert.equal(isPrivateAddress(ip), false, ip);
    }
  });
});

describe('vista previa en mensajes', () => {
  test('por defecto no pide URLs internas (anti-SSRF)', async () => {
    Object.assign(config.linkPreview, { enabled: true, allowPrivate: false });
    const id = await mandar(await conversacion(), `mirá ${base}/pagina`);
    assert.equal(await vistaPrevia(id, 500), null);
  });

  test('con IPs privadas permitidas, guarda la vista previa cifrada', async () => {
    Object.assign(config.linkPreview, { enabled: true, allowPrivate: true });
    const id = await mandar(await conversacion(), `mirá ${base}/redirige`);
    const p = await vistaPrevia(id);
    assert.equal(p?.title, 'Informe & resultados');
    assert.equal(p?.url, `${base}/pagina`, 'sigue la redirección');

    const fila = await db.selectFrom('messages').select('link_preview').where('id', '=', id).executeTakeFirst();
    const crudo = JSON.stringify(fila?.link_preview);
    assert.ok(!crudo.includes('Informe'), 'el título quedó en texto plano en la base');
  });

  test('al editar el link se recalcula; un archivo no da vista previa', async () => {
    Object.assign(config.linkPreview, { enabled: true, allowPrivate: true });
    const conv = await conversacion();
    const id = await mandar(conv, `${base}/pagina`);
    assert.equal((await vistaPrevia(id))?.title, 'Informe & resultados');

    const r = await pedir(`/api/messages/${id}`, { method: 'PUT', token: ana.token, body: { body: `${base}/otra` } });
    assert.equal(r.status, 200, r.texto);
    const hasta = Date.now() + 2000;
    let titulo: string | undefined;
    while (Date.now() < hasta && titulo !== 'Otra página') {
      titulo = (await vistaPrevia(id, 0))?.title;
      if (titulo !== 'Otra página') await new Promise((res) => setTimeout(res, 50));
    }
    assert.equal(titulo, 'Otra página');

    const pdf = await mandar(conv, `${base}/archivo`);
    assert.equal(await vistaPrevia(pdf, 500), null);
  });
});
