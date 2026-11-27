/**
 * Pipeline de media seguro: quitar EXIF de las imágenes (Fase 4.2) y escanear
 * con ClamAV antes de guardar (Fase 4.3). clamd se reemplaza por un servidor TCP
 * falso que habla el protocolo INSTREAM; `config.antivirus` se lee en cada
 * escaneo, así que cada test lo apunta a donde necesita.
 */
import { DIR_ALMACENAMIENTO } from './helpers/almacenamientoLocal';
import { after, afterEach, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'net';
import type { AddressInfo } from 'net';
import { rmSync } from 'fs';
import sharp from 'sharp';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';
import config from '../src/config';
import { storageRepository } from '../src/repositories';
import { db } from '../src/config/db';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

let servidor: ServidorDeTest;
let pedir: Cliente;
let ana: UsuarioDeTest;
const antivirusOriginal = { ...config.antivirus };

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  ana = await crearUsuario(pedir, 'media');
});
after(async () => {
  await servidor.cerrar();
  rmSync(DIR_ALMACENAMIENTO, { recursive: true, force: true });
});
afterEach(() => {
  Object.assign(config.antivirus, antivirusOriginal);
});

async function subir(contenido: Buffer | string, nombre: string, tipo: string, objectType = 'document') {
  const form = new FormData();
  const bytes = typeof contenido === 'string' ? contenido : new Uint8Array(contenido);
  form.append('file', new Blob([bytes], { type: tipo }), nombre);
  form.append('object_type', objectType);
  const res = await fetch(`${servidor.base}/api/storage/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ana.token}` },
    body: form,
  });
  return { status: res.status, cuerpo: (await res.json()) as { data: { id: string; image_width: number; image_height: number }; details?: { code?: string } } };
}

async function descargar(objectId: string): Promise<Buffer> {
  const r = await pedir(`/api/storage/${objectId}/url`, { token: ana.token });
  assert.equal(r.status, 200, r.texto);
  const res = await fetch(servidor.base + r.datos.url);
  assert.equal(res.status, 200);
  return Buffer.from(await res.arrayBuffer());
}

/** clamd falso: junta el stream INSTREAM y contesta OK o FOUND si trae EICAR. */
async function clamdFalso(): Promise<{ puerto: number; recibidos: Buffer[]; cerrar: () => Promise<void> }> {
  const recibidos: Buffer[] = [];
  const server = net.createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, Buffer.from(chunk)]);
      const cmd = 'zINSTREAM\0';
      if (buf.length < cmd.length) return;
      // Recorre los trozos [largo de 4 bytes][datos] hasta el de largo 0.
      let i = cmd.length;
      const partes: Buffer[] = [];
      while (i + 4 <= buf.length) {
        const len = buf.readUInt32BE(i);
        if (len === 0) {
          const archivo = Buffer.concat(partes);
          recibidos.push(archivo);
          socket.end(archivo.includes(EICAR) ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
          return;
        }
        if (i + 4 + len > buf.length) return;
        partes.push(buf.subarray(i + 4, i + 4 + len));
        i += 4 + len;
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return {
    puerto: (server.address() as AddressInfo).port,
    recibidos,
    cerrar: () => new Promise((r) => server.close(() => r())),
  };
}

/** Un puerto donde no escucha nadie. */
async function puertoCerrado(): Promise<number> {
  const s = net.createServer();
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address() as AddressInfo;
  await new Promise((r) => s.close(r));
  return port;
}

describe('EXIF', () => {
  test('una foto con GPS y orientación se guarda sin metadatos y ya rotada', async () => {
    // 40×20 con orientación 6 (rotar 90°): a la vista es 20×40.
    const foto = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#c33' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'CamaraDeTest' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '34/1 36/1 0/1' } })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const original = await sharp(foto).metadata();
    assert.ok(original.exif, 'la foto de prueba tiene que traer EXIF');
    assert.equal(original.orientation, 6);

    const { status, cuerpo } = await subir(foto, 'foto.jpg', 'image/jpeg', 'image');
    assert.equal(status, 201, JSON.stringify(cuerpo));
    assert.equal(cuerpo.data.image_width, 20);
    assert.equal(cuerpo.data.image_height, 40);

    const guardada = await sharp(await descargar(cuerpo.data.id)).metadata();
    assert.equal(guardada.exif, undefined);
    assert.equal(guardada.orientation, undefined);
    assert.equal(guardada.width, 20);
    assert.equal(guardada.height, 40);

    const fila = await storageRepository.findById(cuerpo.data.id);
    assert.equal(fila?.exif_stripped, true);
  });

  test('una imagen sin metadatos se guarda byte por byte igual', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#0a0' } }).png().toBuffer();
    const { status, cuerpo } = await subir(png, 'captura.png', 'image/png', 'image');
    assert.equal(status, 201, JSON.stringify(cuerpo));
    assert.ok((await descargar(cuerpo.data.id)).equals(png));
  });

  test('un documento no se toca', async () => {
    const { status, cuerpo } = await subir('texto plano', 'nota.txt', 'text/plain');
    assert.equal(status, 201, JSON.stringify(cuerpo));
    assert.equal((await descargar(cuerpo.data.id)).toString(), 'texto plano');
    assert.equal((await storageRepository.findById(cuerpo.data.id))?.exif_stripped, false);
  });
});

describe('antivirus', () => {
  test('sin CLAMAV_HOST el escaneo queda en skipped', async () => {
    config.antivirus.host = '';
    const { status, cuerpo } = await subir('hola', 'a.txt', 'text/plain');
    assert.equal(status, 201);
    const fila = await storageRepository.findById(cuerpo.data.id);
    assert.equal(fila?.virus_scan_status, 'skipped');
    assert.equal(fila?.virus_scanned_at, null);
  });

  test('un archivo limpio se marca clean y clamd recibe el contenido completo', async () => {
    const clamd = await clamdFalso();
    try {
      Object.assign(config.antivirus, { host: '127.0.0.1', port: clamd.puerto });
      // Más grande que un trozo (64 KB) para cubrir el envío en partes.
      const grande = Buffer.alloc(200 * 1024, 'a');
      const { status, cuerpo } = await subir(grande, 'grande.txt', 'text/plain');
      assert.equal(status, 201, JSON.stringify(cuerpo));
      assert.ok(clamd.recibidos.at(-1)?.equals(grande));
      const fila = await storageRepository.findById(cuerpo.data.id);
      assert.equal(fila?.virus_scan_status, 'clean');
      assert.ok(fila?.virus_scanned_at);
    } finally {
      await clamd.cerrar();
    }
  });

  test('un archivo infectado se rechaza con 422 y no se guarda', async () => {
    const clamd = await clamdFalso();
    try {
      Object.assign(config.antivirus, { host: '127.0.0.1', port: clamd.puerto });
      const nombre = `eicar-${Date.now()}.com`;
      const { status, cuerpo } = await subir(EICAR, nombre, 'application/octet-stream');
      assert.equal(status, 422, JSON.stringify(cuerpo));
      assert.equal(cuerpo.details?.code, 'MALWARE_DETECTED');

      const guardados = await db.selectFrom('storage_objects').select('id')
        .where('original_filename', '=', nombre).execute();
      assert.equal(guardados.length, 0);

      // La auditoría se escribe sin esperar a la respuesta: se le da un momento.
      let auditada = false;
      for (let i = 0; i < 20 && !auditada; i++) {
        const filas = await db.selectFrom('audit_log').select('metadata')
          .where('action', '=', 'media.malware_blocked').where('actor_id', '=', ana.id).execute();
        auditada = filas.some((f) => JSON.stringify(f.metadata).includes(nombre));
        if (!auditada) await new Promise((r) => setTimeout(r, 50));
      }
      assert.ok(auditada, 'falta el registro de auditoría');
    } finally {
      await clamd.cerrar();
    }
  });

  test('clamd caído: se guarda como error, o se rechaza con 503 si es obligatorio', async () => {
    Object.assign(config.antivirus, { host: '127.0.0.1', port: await puertoCerrado(), required: false });
    const blando = await subir('hola', 'b.txt', 'text/plain');
    assert.equal(blando.status, 201);
    assert.equal((await storageRepository.findById(blando.cuerpo.data.id))?.virus_scan_status, 'error');

    config.antivirus.required = true;
    const estricto = await subir('hola', 'c.txt', 'text/plain');
    assert.equal(estricto.status, 503);
  });
});
