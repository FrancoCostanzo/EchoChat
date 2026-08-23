/**
 * Recorre la superficie HTTP: al menos un endpoint por cada controller. No
 * busca cubrir cada rama de negocio, sino que ninguna ruta se haya quedado
 * desconectada —que es el modo típico de romper algo al refactorizar la capa.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, lista, sufijo, type Cliente } from './helpers/api';
import { crearUsuario, type UsuarioDeTest } from './helpers/usuarios';

let servidor: ServidorDeTest;
let pedir: Cliente;
let ana: UsuarioDeTest;
let beto: UsuarioDeTest;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  ana = await crearUsuario(pedir, 'ana');
  beto = await crearUsuario(pedir, 'beto');
});
after(() => servidor.cerrar());

/** Conversación directa entre ana y beto, nueva en cada test que la pide. */
async function conversacionDirecta(): Promise<string> {
  const r = await pedir('/api/conversations', {
    method: 'POST', token: ana.token, body: { type: 'direct', member_ids: [beto.id] },
  });
  assert.equal(r.status, 201);
  return r.datos.id;
}

async function grupo(): Promise<string> {
  const r = await pedir('/api/conversations', {
    method: 'POST', token: ana.token, body: { type: 'group', name: 'Grupo ' + sufijo(), member_ids: [beto.id] },
  });
  assert.equal(r.status, 201);
  return r.datos.id;
}

async function mensaje(conversationId: string, texto = 'hola'): Promise<string> {
  const r = await pedir('/api/messages', {
    method: 'POST', token: ana.token, body: { conversation_id: conversationId, type: 'text', body: texto },
  });
  assert.equal(r.status, 201);
  return r.datos.id;
}

describe('usuarios', () => {
  test('perfil: leer, actualizar y cambiar presencia', async () => {
    assert.equal((await pedir('/api/users/me', { token: ana.token })).status, 200);
    const perfil = await pedir('/api/users/me', { method: 'PUT', token: ana.token, body: { display_name: 'Ana Nueva' } });
    assert.equal(perfil.datos.display_name, 'Ana Nueva');
    const presencia = await pedir('/api/users/me/presence', { method: 'PUT', token: ana.token, body: { presence: 'busy' } });
    assert.equal(presencia.datos.presence, 'busy');
  });

  test('búsqueda y consulta por id', async () => {
    const r = await pedir(`/api/users/search?q=${beto.username}&limit=5`, { token: ana.token });
    assert.ok(lista(r).some((u: any) => u.username === beto.username));
    assert.equal((await pedir(`/api/users/${beto.id}`, { token: ana.token })).datos.id, beto.id);
  });
});

describe('conversaciones', () => {
  test('crea la directa con los dos miembros y la devuelve por id', async () => {
    const id = await conversacionDirecta();
    assert.equal((await pedir(`/api/conversations/${id}`, { token: ana.token })).datos.id, id);
    assert.equal(lista(await pedir(`/api/conversations/${id}/members?limit=10`, { token: ana.token })).length, 2);
    assert.ok(lista(await pedir('/api/conversations?limit=10', { token: ana.token })).length >= 1);
  });

  test('renombra el grupo y cambia el rol de un miembro', async () => {
    const id = await grupo();
    const nuevo = await pedir(`/api/conversations/${id}`, { method: 'PUT', token: ana.token, body: { name: 'Renombrado' } });
    assert.equal(nuevo.datos.name, 'Renombrado');
    assert.equal((await pedir(`/api/conversations/${id}/members/${beto.id}`, {
      method: 'PUT', token: ana.token, body: { role: 'admin' },
    })).status, 200);
  });
});

describe('mensajes', () => {
  test('envía, pagina, edita y borra', async () => {
    const conv = await conversacionDirecta();
    const id = await mensaje(conv, 'hola ' + sufijo());

    assert.ok(lista(await pedir(`/api/messages/conversation/${conv}?limit=10`, { token: ana.token })).length >= 1);
    assert.equal((await pedir(`/api/messages/${id}`, { token: ana.token })).datos.id, id);

    const editado = await pedir(`/api/messages/${id}`, { method: 'PUT', token: ana.token, body: { body: 'editado' } });
    assert.equal(editado.datos.is_edited, true);

    const borrado = await pedir(`/api/messages/${id}`, { method: 'DELETE', token: ana.token });
    assert.equal(borrado.datos.is_deleted, true);
  });

  test('reacciones y acuses de lectura', async () => {
    const conv = await conversacionDirecta();
    const id = await mensaje(conv);

    assert.equal((await pedir(`/api/messages/${id}/reactions`, { method: 'POST', token: beto.token, body: { emoji: '👍' } })).status, 200);
    assert.equal((await pedir(`/api/messages/${id}/reactions/${encodeURIComponent('👍')}`, { method: 'DELETE', token: beto.token })).status, 200);
    assert.equal((await pedir(`/api/messages/${id}/receipts`, { method: 'POST', token: beto.token, body: { type: 'read' } })).status, 200);
    assert.equal((await pedir(`/api/messages/${id}/info`, { token: ana.token })).status, 200);
    assert.equal((await pedir(`/api/messages/${id}/thread`, { token: ana.token })).status, 200);
    assert.equal((await pedir(`/api/conversations/${conv}/read`, { method: 'POST', token: beto.token, body: { message_id: id } })).status, 200);
  });

  test('la búsqueda encuentra por el índice ciego', async () => {
    const conv = await conversacionDirecta();
    const palabra = 'zanahoria' + sufijo();
    await mensaje(conv, `pasame la ${palabra} por favor`);
    const r = await pedir(`/api/messages/conversation/${conv}/search?q=${palabra}&limit=5`, { token: ana.token });
    assert.equal(lista(r).length, 1);
  });

  test('fijar y dejar de fijar', async () => {
    const conv = await conversacionDirecta();
    const id = await mensaje(conv);
    assert.equal((await pedir(`/api/messages/conversation/${conv}/pin/${id}`, { method: 'POST', token: ana.token })).status, 200);
    assert.equal(lista(await pedir(`/api/messages/conversation/${conv}/pinned`, { token: ana.token })).length, 1);
    assert.equal((await pedir(`/api/messages/conversation/${conv}/pin/${id}`, { method: 'DELETE', token: ana.token })).status, 200);
    assert.equal(lista(await pedir(`/api/messages/conversation/${conv}/pinned`, { token: ana.token })).length, 0);
  });

  test('guardar, listar guardados y reenviar', async () => {
    const conv = await conversacionDirecta();
    const destino = await grupo();
    const id = await mensaje(conv);

    assert.equal((await pedir(`/api/messages/${id}/save`, { method: 'POST', token: ana.token, body: { note: 'nota' } })).status, 201);
    assert.ok(lista(await pedir('/api/messages/saved?limit=10', { token: ana.token })).length >= 1);
    assert.equal((await pedir(`/api/messages/${id}/save`, { method: 'DELETE', token: ana.token })).status, 200);
    assert.equal((await pedir(`/api/messages/${id}/forward`, {
      method: 'POST', token: ana.token, body: { conversation_ids: [destino] },
    })).status, 201);
  });

  test('borradores: guardar, leer y borrar', async () => {
    const conv = await conversacionDirecta();
    assert.equal((await pedir(`/api/messages/conversation/${conv}/draft`, {
      method: 'PUT', token: ana.token, body: { body: 'borrador a medio escribir' },
    })).status, 200);

    const leido = await pedir(`/api/messages/conversation/${conv}/draft`, { token: ana.token });
    assert.equal(leido.datos.body, 'borrador a medio escribir');
    assert.ok(lista(await pedir('/api/messages/drafts', { token: ana.token })).length >= 1);
    assert.equal((await pedir(`/api/messages/conversation/${conv}/draft`, { method: 'DELETE', token: ana.token })).status, 200);
  });
});

describe('encuestas', () => {
  test('crea, vota, retracta y cierra', async () => {
    const conv = await grupo();
    const creada = await pedir('/api/polls', {
      method: 'POST', token: ana.token, body: { conversation_id: conv, question: '¿Cuál?', options: ['uno', 'dos'] },
    });
    assert.equal(creada.status, 201);

    const encuesta = creada.datos.poll;
    assert.ok(encuesta?.id, 'la encuesta tiene que venir colgada del mensaje');

    assert.equal((await pedir(`/api/polls/${encuesta.id}/vote`, {
      method: 'POST', token: beto.token, body: { option_ids: [encuesta.options[0].id] },
    })).status, 200);
    assert.equal((await pedir(`/api/polls/${encuesta.id}/vote`, { method: 'DELETE', token: beto.token })).status, 200);
    assert.equal((await pedir(`/api/polls/${encuesta.id}/close`, { method: 'POST', token: ana.token })).status, 200);
  });
});

describe('minijuegos', () => {
  test('crea un tatetí y acepta una jugada', async () => {
    const conv = await conversacionDirecta();
    const creado = await pedir('/api/games', {
      method: 'POST', token: ana.token, body: { conversation_id: conv, kind: 'tictactoe' },
    });
    assert.equal(creado.status, 201);

    const juego = creado.datos.game;
    assert.ok(juego?.id, 'el juego tiene que venir colgado del mensaje');
    assert.equal((await pedir(`/api/games/${juego.id}/move`, { method: 'POST', token: ana.token, body: { cell: 0 } })).status, 200);
  });
});

describe('relaciones', () => {
  test('contactos y favoritos se crean, listan y borran', async () => {
    const u = await crearUsuario(pedir, 'rel');
    assert.equal((await pedir('/api/relationships', {
      method: 'POST', token: u.token, body: { target_user_id: beto.id, type: 'contact' },
    })).status, 201);
    assert.equal(lista(await pedir('/api/relationships/contacts', { token: u.token })).length, 1);

    assert.equal((await pedir('/api/relationships', {
      method: 'POST', token: u.token, body: { target_user_id: beto.id, type: 'favorite' },
    })).status, 201);
    assert.equal(lista(await pedir('/api/relationships/favorites', { token: u.token })).length, 1);
    assert.equal(lista(await pedir('/api/relationships/blocked', { token: u.token })).length, 0);

    assert.equal((await pedir(`/api/relationships/${beto.id}/contact`, { method: 'DELETE', token: u.token })).status, 200);
    assert.equal(lista(await pedir('/api/relationships/contacts', { token: u.token })).length, 0);
  });
});

describe('notificaciones', () => {
  test('listado, contador, preferencias y marcar todo como leído', async () => {
    assert.equal((await pedir('/api/notifications?limit=10&offset=0', { token: beto.token })).status, 200);
    assert.equal(typeof (await pedir('/api/notifications/count', { token: beto.token })).datos.count, 'number');
    assert.equal((await pedir('/api/notifications/preferences', { token: beto.token })).status, 200);
    assert.equal((await pedir('/api/notifications/read-all', { method: 'POST', token: beto.token })).status, 200);
    assert.equal((await pedir('/api/notifications?unread=true', { token: beto.token })).status, 200);
  });
});

describe('fondos de pantalla', () => {
  test('guarda el fondo global y lo borra', async () => {
    const u = await crearUsuario(pedir, 'wall');
    assert.equal((await pedir('/api/preferences/wallpapers', {
      method: 'PUT', token: u.token,
      body: { scope: 'global', scope_key: 'global', wallpaper_type: 'preset', wallpaper_value: 'aurora' },
    })).status, 200);
    assert.ok(lista(await pedir('/api/preferences/wallpapers', { token: u.token })).length >= 1);
    assert.equal((await pedir('/api/preferences/wallpapers/global/global', { method: 'DELETE', token: u.token })).status, 200);
  });
});

describe('llamadas', () => {
  test('inicia, consulta y finaliza', async () => {
    const conv = await conversacionDirecta();
    const llamada = await pedir('/api/calls', {
      method: 'POST', token: ana.token, body: { conversation_id: conv, type: 'voice', participant_ids: [beto.id] },
    });
    assert.equal(llamada.status, 201);
    const id = llamada.datos.id;

    assert.equal((await pedir('/api/calls/active', { token: ana.token })).status, 200);
    assert.equal((await pedir('/api/calls/history?limit=10&offset=0', { token: ana.token })).status, 200);
    assert.equal((await pedir(`/api/calls/conversation/${conv}?limit=5`, { token: ana.token })).status, 200);
    assert.equal((await pedir(`/api/calls/${id}`, { token: ana.token })).datos.id, id);
    assert.equal((await pedir(`/api/calls/${id}/status`, {
      method: 'PUT', token: ana.token, body: { status: 'ended', end_reason: 'hangup' },
    })).status, 200);
  });

  test('una llamada sin conversación se inicia y se termina sin romper', async () => {
    // conversation_id es opcional en el DTO, y sin él no hay timeline donde
    // dejar el mensaje de sistema que resume la llamada.
    const llamada = await pedir('/api/calls', {
      method: 'POST', token: ana.token, body: { type: 'voice', participant_ids: [beto.id] },
    });
    assert.equal(llamada.status, 201);
    assert.equal(llamada.datos.conversation_id, null);

    assert.equal((await pedir(`/api/calls/${llamada.datos.id}/status`, {
      method: 'PUT', token: ana.token, body: { status: 'ended', end_reason: 'hangup' },
    })).status, 200);
  });
});

describe('canales', () => {
  test('crea, descubre, ajusta y recibe solicitudes', async () => {
    const creado = await pedir('/api/channels', {
      method: 'POST', token: ana.token,
      body: { name: 'Canal ' + sufijo(), description: 'de prueba', visibility: 'public' },
    });
    assert.equal(creado.status, 201);
    const id = creado.datos.id;

    assert.equal((await pedir('/api/channels/discover?limit=10&offset=0', { token: beto.token })).status, 200);
    assert.equal((await pedir(`/api/channels/${id}`, { token: ana.token })).datos.id, id);
    assert.equal((await pedir(`/api/channels/${id}/settings`, {
      method: 'PUT', token: ana.token, body: { post_restriction: 'admins_only' },
    })).status, 200);
    assert.equal((await pedir(`/api/channels/${id}/join`, { method: 'POST', token: beto.token, body: {} })).status, 201);
    assert.equal((await pedir(`/api/channels/${id}/requests?limit=10`, { token: ana.token })).status, 200);
  });
});

describe('difusiones', () => {
  test('lista, envía y registra entregas', async () => {
    const lista_ = await pedir('/api/broadcasts', {
      method: 'POST', token: ana.token, body: { name: 'Lista ' + sufijo(), recipient_ids: [beto.id] },
    });
    assert.equal(lista_.status, 201);
    const id = lista_.datos.id;

    assert.equal((await pedir(`/api/broadcasts/${id}`, { token: ana.token })).datos.recipients.length, 1);
    assert.ok(lista(await pedir('/api/broadcasts', { token: ana.token })).length >= 1);

    const envio = await pedir(`/api/broadcasts/${id}/messages`, {
      method: 'POST', token: ana.token, body: { body: 'difusión de prueba', type: 'text' },
    });
    assert.equal(envio.status, 201);

    assert.ok(lista(await pedir(`/api/broadcasts/${id}/messages`, { token: ana.token })).length >= 1);
    assert.equal(lista(await pedir(`/api/broadcasts/${id}/messages/${envio.datos.id}/deliveries`, { token: ana.token })).length, 1);

    assert.equal((await pedir(`/api/broadcasts/${id}/recipients`, {
      method: 'POST', token: ana.token, body: { recipient_ids: [ana.id] },
    })).status, 201);
    assert.equal((await pedir(`/api/broadcasts/${id}/recipients/${ana.id}`, { method: 'DELETE', token: ana.token })).status, 200);
  });
});

describe('stickers y almacenamiento', () => {
  test('colección y packs', async () => {
    assert.equal((await pedir('/api/stickers', { token: ana.token })).status, 200);
    assert.equal((await pedir('/api/stickers?search=nada', { token: ana.token })).status, 200);

    const pack = await pedir('/api/stickers/packs', { method: 'POST', token: ana.token, body: { name: 'Pack ' + sufijo() } });
    assert.equal(pack.status, 201);
    assert.equal((await pedir(`/api/stickers/packs/${pack.datos.id}`, {
      method: 'PATCH', token: ana.token, body: { name: 'Pack renombrado' },
    })).status, 200);
    assert.equal((await pedir(`/api/stickers/packs/${pack.datos.id}`, { method: 'DELETE', token: ana.token })).status, 200);
  });

  test('subir sin archivo da 400, no 500', async () => {
    // Antes se leía req.file.buffer sin chequear y salía un TypeError.
    assert.equal((await pedir('/api/storage/upload', { method: 'POST', token: ana.token, body: {} })).status, 400);
  });
});

describe('endpoints públicos de auth', () => {
  test('proveedores SSO y estado del registro no piden token', async () => {
    assert.equal((await pedir('/api/auth/sso/providers')).status, 200);
    assert.equal(typeof (await pedir('/api/auth/registration-status')).datos.allow_registration, 'boolean');
  });
});
