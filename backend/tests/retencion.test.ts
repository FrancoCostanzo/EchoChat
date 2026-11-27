/**
 * Retención de mensajes (Fase 8.8): `message_retention_days` + `messageService.purgeExpired`.
 *
 * La base de tests no se limpia entre corridas, así que los mensajes "viejos" se
 * fechan 30 años atrás y la retención se fija en 20 años: así sólo vencen los de
 * este archivo y no los que dejaron otras corridas.
 */
import { DIR_ALMACENAMIENTO } from './helpers/almacenamientoLocal';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'fs';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';
import { db } from '../src/config/db';
import { messageService } from '../src/services';
import { systemSettingsRepository } from '../src/repositories';

const DIAS = 20 * 365;
const HACE_30_ANIOS = new Date(Date.now() - 30 * 365 * 24 * 3600 * 1000);

let servidor: ServidorDeTest;
let pedir: Cliente;
let ana: UsuarioDeTest;
let beto: UsuarioDeTest;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  ana = await crearUsuario(pedir, 'ret');
  beto = await crearUsuario(pedir, 'ret');
});
after(async () => {
  await systemSettingsRepository.update('message_retention_days', '0', null);
  await servidor.cerrar();
  rmSync(DIR_ALMACENAMIENTO, { recursive: true, force: true });
});

async function conversacion(): Promise<string> {
  const r = await pedir('/api/conversations', {
    method: 'POST', token: ana.token, body: { type: 'group', name: 'Retención', member_ids: [beto.id] },
  });
  assert.equal(r.status, 201, r.texto);
  return r.datos.id;
}

async function mensaje(conversationId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await pedir('/api/messages', {
    method: 'POST', token: ana.token, body: { conversation_id: conversationId, type: 'text', body: 'hola', ...extra },
  });
  assert.equal(r.status, 201, r.texto);
  return r.datos.id;
}

async function envejecer(...ids: string[]) {
  await db.updateTable('messages').set({ sent_at: HACE_30_ANIOS }).where('id', 'in', ids).execute();
}

async function existe(id: string): Promise<boolean> {
  return !!(await db.selectFrom('messages').select('id').where('id', '=', id).executeTakeFirst());
}

describe('retención de mensajes', () => {
  test('con 0 no borra nada', async () => {
    await systemSettingsRepository.update('message_retention_days', '0', null);
    const conv = await conversacion();
    const viejo = await mensaje(conv);
    await envejecer(viejo);
    assert.deepEqual(await messageService.purgeExpired(), { messages: 0, objects: 0 });
    assert.ok(await existe(viejo));
  });

  test('borra lo vencido, suelta las referencias y conserva lo nuevo', async () => {
    const conv = await conversacion();

    // Adjunto propio de un mensaje viejo: tiene que desaparecer del almacenamiento.
    const form = new FormData();
    form.append('file', new Blob(['contenido viejo'], { type: 'text/plain' }), 'viejo.txt');
    form.append('object_type', 'document');
    const subida = await fetch(`${servidor.base}/api/storage/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${ana.token}` }, body: form,
    });
    const objeto = ((await subida.json()) as { data: { id: string } }).data;
    const conAdjunto = await mensaje(conv, { type: 'media', body: undefined, attachment_ids: [objeto.id] });

    const viejo = await mensaje(conv);
    const respuestaNueva = await mensaje(conv, { reply_to_id: viejo });
    const raizConHiloVivo = await mensaje(conv);
    const respuestaDeHilo = await mensaje(conv, { thread_id: raizConHiloVivo });
    await pedir(`/api/messages/${viejo}/reactions`, { method: 'POST', token: beto.token, body: { emoji: '👍' } });
    await envejecer(conAdjunto, viejo, raizConHiloVivo);

    await systemSettingsRepository.update('message_retention_days', String(DIAS), null);
    const resultado = await messageService.purgeExpired();
    assert.ok(resultado.messages >= 2, JSON.stringify(resultado));
    assert.ok(resultado.objects >= 1, JSON.stringify(resultado));

    assert.equal(await existe(viejo), false);
    assert.equal(await existe(conAdjunto), false);
    assert.equal(
      (await db.selectFrom('storage_objects').select('id').where('id', '=', objeto.id).executeTakeFirst()),
      undefined,
    );

    // La respuesta sigue, pero ya no apunta al mensaje borrado.
    const respuesta = await db.selectFrom('messages').select('reply_to_id').where('id', '=', respuestaNueva).executeTakeFirst();
    assert.equal(respuesta?.reply_to_id, null);

    // Una raíz vieja con respuestas nuevas espera a que venza el hilo entero.
    assert.ok(await existe(raizConHiloVivo));
    assert.ok(await existe(respuestaDeHilo));

    // El timeline sigue cargando.
    const timeline = await pedir(`/api/messages/conversation/${conv}`, { token: beto.token });
    assert.equal(timeline.status, 200, timeline.texto);
  });

  test('una conversación vencida entera queda sin último mensaje', async () => {
    const conv = await conversacion();
    const unico = await mensaje(conv);
    await envejecer(unico);
    await systemSettingsRepository.update('message_retention_days', String(DIAS), null);
    await messageService.purgeExpired();

    assert.equal(await existe(unico), false);
    const fila = await db.selectFrom('conversations').select('last_message_id').where('id', '=', conv).executeTakeFirst();
    assert.equal(fila?.last_message_id, null);

    const lista = await pedir('/api/conversations', { token: ana.token });
    assert.equal(lista.status, 200, lista.texto);
  });
});
