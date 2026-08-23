/**
 * Panel de administración y monitoreo. Además del camino feliz, cubre las
 * guardas que impiden que un admin se deje afuera a sí mismo o a la instalación
 * entera, y que un usuario común llegue al panel.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { levantarServidor, ADMIN, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, lista, sufijo, type Cliente } from './helpers/api';
import { crearUsuario, iniciarSesion, type UsuarioDeTest } from './helpers/usuarios';

let servidor: ServidorDeTest;
let pedir: Cliente;
let admin: UsuarioDeTest;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
  admin = await iniciarSesion(pedir, ADMIN.username, ADMIN.password);
});
after(() => servidor.cerrar());

/** Crea un usuario desde el panel y devuelve su id. */
async function crearDesdeElPanel(prefijo = 'adm') {
  const username = prefijo + sufijo();
  const r = await pedir('/api/admin/users', {
    method: 'POST', token: admin.token,
    body: { username, display_name: 'Creado por el panel', password: 'ClaveDelPanel123!', role_names: ['user'] },
  });
  assert.equal(r.status, 201);
  return { id: r.datos.id as string, username, clave: 'ClaveDelPanel123!' };
}

describe('gestión de usuarios', () => {
  test('crea con roles, y rechaza el username repetido', async () => {
    const u = await crearDesdeElPanel();
    const repetido = await pedir('/api/admin/users', {
      method: 'POST', token: admin.token,
      body: { username: u.username, display_name: 'x', password: 'ClaveDelPanel123!' },
    });
    assert.equal(repetido.status, 409);
  });

  test('el listado filtra por búsqueda e informa si tiene 2FA', async () => {
    const u = await crearDesdeElPanel('filtro');
    const r = await pedir(`/api/admin/users?search=${u.username}`, { token: admin.token });
    assert.equal(lista(r).length, 1);
    assert.equal(lista(r)[0].totp_enabled, false);
  });

  test('actualiza perfil y roles', async () => {
    const u = await crearDesdeElPanel();
    const perfil = await pedir(`/api/admin/users/${u.id}`, {
      method: 'PATCH', token: admin.token, body: { display_name: 'Renombrado', department: 'Sistemas' },
    });
    assert.equal(perfil.datos.display_name, 'Renombrado');
    assert.equal(perfil.datos.department, 'Sistemas');

    const roles = await pedir(`/api/admin/users/${u.id}`, {
      method: 'PATCH', token: admin.token, body: { role_names: ['admin'] },
    });
    assert.ok(roles.datos.roles.includes('admin'));
  });

  test('resetear la contraseña revoca las sesiones abiertas', async () => {
    const u = await crearDesdeElPanel();
    const victima = await iniciarSesion(pedir, u.username, u.clave);

    assert.equal((await pedir(`/api/admin/users/${u.id}/password`, {
      method: 'PATCH', token: admin.token, body: { password: 'ClaveNuevaDelPanel456!' },
    })).status, 200);

    assert.equal((await pedir('/api/users/me', { token: victima.token })).status, 401);
    assert.equal((await pedir('/api/auth/login', {
      method: 'POST', body: { username: u.username, password: 'ClaveNuevaDelPanel456!' },
    })).status, 200);
  });

  test('suspender revoca las sesiones y bloquea el login', async () => {
    const u = await crearDesdeElPanel();
    const victima = await iniciarSesion(pedir, u.username, u.clave);

    await pedir(`/api/admin/users/${u.id}`, { method: 'PATCH', token: admin.token, body: { status: 'suspended' } });

    assert.equal((await pedir('/api/users/me', { token: victima.token })).status, 401);
    assert.equal((await pedir('/api/auth/login', {
      method: 'POST', body: { username: u.username, password: u.clave },
    })).status, 401);
  });

  test('el borrado lógico lo saca del listado', async () => {
    const u = await crearDesdeElPanel('borr');
    assert.equal((await pedir(`/api/admin/users/${u.id}`, { method: 'DELETE', token: admin.token })).status, 200);
    assert.equal(lista(await pedir(`/api/admin/users?search=${u.username}`, { token: admin.token })).length, 0);
  });
});

describe('guardas del panel', () => {
  test('no deja quitarle el rol al último super_admin', async () => {
    const r = await pedir(`/api/admin/users/${admin.id}`, {
      method: 'PATCH', token: admin.token, body: { role_names: ['user'] },
    });
    assert.equal(r.status, 400);
    assert.match(r.cuerpo.message, /super_admin/);
  });

  test('no deja borrarse ni suspenderse a uno mismo', async () => {
    assert.equal((await pedir(`/api/admin/users/${admin.id}`, { method: 'DELETE', token: admin.token })).status, 403);
    assert.equal((await pedir(`/api/admin/users/${admin.id}`, {
      method: 'PATCH', token: admin.token, body: { status: 'suspended' },
    })).status, 403);
  });
});

describe('integraciones, settings, auditoría y storage', () => {
  test('reporta el estado de LDAP, SSO y SCIM', async () => {
    const r = await pedir('/api/admin/integrations', { token: admin.token });
    assert.equal(r.status, 200);
    for (const clave of ['ldap', 'sso', 'scim']) assert.ok(clave in r.datos);
    assert.equal((await pedir('/api/admin/ldap/status', { token: admin.token })).status, 200);
  });

  test('lista roles y settings, y actualiza un setting', async () => {
    assert.ok(lista(await pedir('/api/admin/roles', { token: admin.token })).length > 0);

    const settings = lista(await pedir('/api/admin/settings', { token: admin.token }));
    assert.ok(settings.length > 0);

    const primero = settings[0];
    const r = await pedir(`/api/admin/settings/${primero.key}`, {
      method: 'PUT', token: admin.token, body: { value: primero.value },
    });
    assert.equal(r.status, 200);
    assert.ok('value' in r.datos);

    assert.equal((await pedir(`/api/admin/settings/no.existe.${sufijo()}`, {
      method: 'PUT', token: admin.token, body: { value: 1 },
    })).status, 404);
  });

  test('la auditoría registra las acciones con el nombre del actor y filtra por acción', async () => {
    const u = await crearDesdeElPanel('audit');
    await pedir(`/api/admin/users/${u.id}`, { method: 'DELETE', token: admin.token });

    const todo = await pedir('/api/admin/audit?limit=10', { token: admin.token });
    assert.ok(lista(todo).length > 0);
    assert.equal(typeof todo.datos.total, 'number');
    assert.ok(lista(todo).some((e: any) => e.actor_username), 'el JOIN con el actor tiene que traer el username');

    const filtrado = await pedir('/api/admin/audit?action=admin.user_delete', { token: admin.token });
    assert.ok(lista(filtrado).length > 0);
    assert.ok(lista(filtrado).every((e: any) => e.action === 'admin.user_delete'));
  });

  test('estadísticas y listado de storage responden', async () => {
    assert.equal((await pedir('/api/admin/storage/stats', { token: admin.token })).status, 200);
    assert.equal((await pedir('/api/admin/storage/objects?limit=5', { token: admin.token })).status, 200);
  });
});

describe('monitoreo', () => {
  test('los probes de salud son públicos', async () => {
    const vivo = await pedir('/api/health/live');
    assert.equal(vivo.status, 200);
    assert.equal(vivo.datos.status, 'alive');

    const listo = await pedir('/api/health/ready');
    assert.equal(listo.status, 200);
    assert.equal(listo.datos.ready, true);
  });

  test('el healthcheck informa el estado de Redis sin condicionar el código', async () => {
    const r = await pedir('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.db, 'ok');
    // La suite corre sin REDIS_URL, que es una configuración válida.
    assert.equal(r.cuerpo.redis, 'disabled');
  });

  test('el dashboard trae salud, build y métricas del cluster', async () => {
    const r = await pedir('/api/monitoring/dashboard', { token: admin.token });
    assert.equal(r.status, 200);

    const d = r.datos;
    assert.ok(['healthy', 'degraded', 'unhealthy'].includes(d.overallStatus));
    assert.ok(d.components.server.info);
    assert.ok(d.components.database.pool);
    assert.equal(typeof d.components.database.connection.responseTime, 'number');
    assert.ok(d.build.version && d.build.version !== 'unknown');
    // `instancias` es un contador, no un array: con una sola instancia vale 1.
    assert.equal(typeof d.instancias, 'number');
    assert.ok(d.instancias >= 1);
  });

  test('las métricas del sistema vienen formateadas y en rango', async () => {
    const d = (await pedir('/api/monitoring/system', { token: admin.token })).datos;
    assert.match(d.process.memory.heapUsed, /^[\d.]+ (Bytes|KB|MB|GB)$/);
    assert.ok(d.process.cpu.process.usage >= 0 && d.process.cpu.process.usage <= 100);
    assert.match(d.server.uptimeFormatted, /\d+[dhms]/);
    assert.ok(d.system.memory.usedPercentage > 0);
  });

  test('el detalle del pool y el historial responden', async () => {
    const db = (await pedir('/api/monitoring/database', { token: admin.token })).datos;
    assert.equal(typeof db.databaseSize.size_mb, 'number');
    assert.equal(typeof db.poolStatus.maxConnections, 'number');
    assert.equal((await pedir('/api/monitoring/history?range=1h', { token: admin.token })).status, 200);
  });
});

describe('control de acceso al panel', () => {
  test('un usuario común no llega al panel ni al monitoreo', async () => {
    const comun = await crearUsuario(pedir, 'comun');
    assert.equal((await pedir('/api/admin/users', { token: comun.token })).status, 403);
    assert.equal((await pedir('/api/admin/audit', { token: comun.token })).status, 403);
    assert.equal((await pedir('/api/monitoring/dashboard', { token: comun.token })).status, 403);
  });

  test('sin token el panel responde 401', async () => {
    assert.equal((await pedir('/api/admin/users')).status, 401);
  });
});
