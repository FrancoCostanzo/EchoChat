import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, lista, sufijo, type Cliente } from './helpers/api';
import { activar2fa, crearUsuario, iniciarSesion, totp, CLAVE } from './helpers/usuarios';

let servidor: ServidorDeTest;
let pedir: Cliente;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
});
after(() => servidor.cerrar());

describe('registro y login', () => {
  test('registra, y rechaza el username repetido con 409', async () => {
    const u = await crearUsuario(pedir, 'reg');
    const repetido = await pedir('/api/auth/register', {
      method: 'POST',
      body: { username: u.username, display_name: u.username, password: CLAVE },
    });
    assert.equal(repetido.status, 409);
  });

  test('no distingue entre clave incorrecta y usuario inexistente', async () => {
    const u = await crearUsuario(pedir, 'anon');
    const claveMal = await pedir('/api/auth/login', { method: 'POST', body: { username: u.username, password: 'no-es' } });
    const inexistente = await pedir('/api/auth/login', { method: 'POST', body: { username: 'no.existe.' + sufijo(), password: CLAVE } });

    assert.equal(claveMal.status, 401);
    assert.equal(inexistente.status, 401);
    // Mismo mensaje: si difirieran, servirían para enumerar usuarios.
    assert.equal(claveMal.cuerpo.message, inexistente.cuerpo.message);
  });

  test('bloquea la cuenta tras varios intentos fallidos, aun con la clave correcta', async () => {
    const u = await crearUsuario(pedir, 'bloq');
    for (let i = 0; i < 6; i++) {
      await pedir('/api/auth/login', { method: 'POST', body: { username: u.username, password: 'mala' } });
    }
    const conLaBuena = await pedir('/api/auth/login', { method: 'POST', body: { username: u.username, password: CLAVE } });
    assert.ok([401, 423].includes(conLaBuena.status), `esperaba bloqueo, dio ${conLaBuena.status}`);
    assert.match(conLaBuena.cuerpo.message, /locked/i);
  });
});

describe('validación del token', () => {
  test('acepta el token propio y rechaza uno inventado', async () => {
    const u = await crearUsuario(pedir, 'tok');
    assert.equal((await pedir('/api/users/me', { token: u.token })).status, 200);
    assert.equal((await pedir('/api/users/me', { token: 'no.es.un.jwt' })).status, 401);
  });

  test('rechaza un token bien formado pero firmado con otra clave', async () => {
    const u = await crearUsuario(pedir, 'fake');
    const ajeno = jwt.sign({ sub: u.id }, 'secreto-que-no-es-el-nuestro', { expiresIn: '1h' });
    assert.equal((await pedir('/api/users/me', { token: ajeno })).status, 401);
  });
});

describe('sesiones', () => {
  test('lista las sesiones activas sin exponer el hash del token', async () => {
    const u = await crearUsuario(pedir, 'ses');
    const r = await pedir('/api/auth/sessions', { token: u.token });
    assert.equal(lista(r).length, 1);
    assert.ok(!JSON.stringify(lista(r)[0]).includes('token_hash'));
  });

  test('revocar una sesión mata ese token y deja vivo el otro', async () => {
    const a = await crearUsuario(pedir, 'rev');
    const b = await iniciarSesion(pedir, a.username);

    const sesiones = lista(await pedir('/api/auth/sessions', { token: a.token }));
    assert.equal(sesiones.length, 2);
    const otra = sesiones.find((s: any) => !s.is_current) ?? sesiones[1];
    assert.ok([200, 204].includes((await pedir(`/api/auth/sessions/${otra.id}`, { method: 'DELETE', token: a.token })).status));

    const vivas = [
      (await pedir('/api/users/me', { token: a.token })).status,
      (await pedir('/api/users/me', { token: b.token })).status,
    ];
    // Exactamente una sobrevive: la revocación no puede ser total ni nula.
    assert.equal(vivas.filter((s) => s === 200).length, 1);
  });

  test('logoutAll invalida también la sesión que lo pidió', async () => {
    const u = await crearUsuario(pedir, 'lall');
    await iniciarSesion(pedir, u.username);
    assert.ok([200, 204].includes((await pedir('/api/auth/logout-all', { method: 'POST', token: u.token })).status));
    assert.equal((await pedir('/api/users/me', { token: u.token })).status, 401);
  });

  test('logout deja el token inservible', async () => {
    const u = await crearUsuario(pedir, 'lout');
    assert.equal((await pedir('/api/auth/logout', { method: 'POST', token: u.token })).status, 200);
    assert.equal((await pedir('/api/auth/me', { token: u.token })).status, 401);
  });
});

describe('cambio de contraseña', () => {
  test('exige la actual, y la vieja deja de servir', async () => {
    const u = await crearUsuario(pedir, 'pwd');
    const nueva = 'OtraClaveDistinta456!';

    const conLaMal = await pedir('/api/auth/password', {
      method: 'PUT', token: u.token, body: { current_password: 'no-es', new_password: nueva },
    });
    assert.equal(conLaMal.status, 401);

    const cambio = await pedir('/api/auth/password', {
      method: 'PUT', token: u.token, body: { current_password: CLAVE, new_password: nueva },
    });
    assert.ok([200, 204].includes(cambio.status));

    assert.equal((await pedir('/api/auth/login', { method: 'POST', body: { username: u.username, password: CLAVE } })).status, 401);
    assert.equal((await pedir('/api/auth/login', { method: 'POST', body: { username: u.username, password: nueva } })).status, 200);
  });
});

describe('2FA con TOTP', () => {
  test('el setup entrega secreto y QR, y enable rechaza un código inválido', async () => {
    const u = await crearUsuario(pedir, 'dosfa');
    const setup = await pedir('/api/auth/2fa/setup', { method: 'POST', token: u.token });
    assert.equal(setup.status, 200);
    assert.ok(setup.datos.secret);
    assert.ok(setup.datos.qr_code.startsWith('data:image'));

    const invalido = await pedir('/api/auth/2fa/enable', { method: 'POST', token: u.token, body: { code: '000000' } });
    assert.equal(invalido.status, 401);
  });

  test('con 2FA activo el login devuelve un desafío en vez de una sesión', async () => {
    const u = await crearUsuario(pedir, 'reto');
    await activar2fa(pedir, u.token);
    const login = await pedir('/api/auth/login', { method: 'POST', body: { username: u.username, password: CLAVE } });
    assert.equal(login.datos.requires_2fa, true);
    assert.equal(login.datos.token, undefined);
    assert.ok(login.datos.temp_token);
  });

  test('el desafío acepta el TOTP correcto y emite una sesión usable', async () => {
    const u = await crearUsuario(pedir, 'reto2');
    const { secreto } = await activar2fa(pedir, u.token);
    const login = await pedir('/api/auth/login', { method: 'POST', body: { username: u.username, password: CLAVE } });

    const desafio = await pedir('/api/auth/2fa/challenge', {
      method: 'POST',
      body: { temp_token: login.datos.temp_token, code: await totp.generate({ secret: secreto }) },
    });
    assert.equal(desafio.status, 200);
    assert.equal((await pedir('/api/users/me', { token: desafio.datos.token })).status, 200);
  });

  test('el desafío rechaza un TOTP inválido y un temp_token basura', async () => {
    const u = await crearUsuario(pedir, 'reto3');
    await activar2fa(pedir, u.token);
    const login = await pedir('/api/auth/login', { method: 'POST', body: { username: u.username, password: CLAVE } });

    assert.equal((await pedir('/api/auth/2fa/challenge', {
      method: 'POST', body: { temp_token: login.datos.temp_token, code: '000000' },
    })).status, 401);
    assert.equal((await pedir('/api/auth/2fa/challenge', {
      method: 'POST', body: { temp_token: 'basura.no.jwt', code: '000000' },
    })).status, 401);
  });
});
