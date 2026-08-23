/**
 * Códigos de respaldo del 2FA: el camino de recuperación cuando se pierde el
 * autenticador. Tiene suite propia porque estuvo roto desde siempre —se
 * guardaban hasheando con el guion y se verificaban sin él— y nadie se enteró
 * hasta que se probó de punta a punta.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import scimService from '../src/services/scim.service';
import authService from '../src/services/auth.service';
import { AppError } from '../src/errors';
import { levantarServidor, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, type Cliente } from './helpers/api';
import { activar2fa, crearUsuario, totp, CLAVE, type UsuarioDeTest } from './helpers/usuarios';

let servidor: ServidorDeTest;
let pedir: Cliente;

before(async () => {
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
});
after(() => servidor.cerrar());

/** Deja un usuario con 2FA activo y devuelve con qué desafiarlo. */
async function conDosFactores(prefijo: string) {
  const usuario = await crearUsuario(pedir, prefijo);
  const { secreto, codigosDeRespaldo } = await activar2fa(pedir, usuario.token);

  /** Pide un desafío nuevo y lo responde con el código dado. */
  const responderDesafio = async (codigo: string) => {
    const login = await pedir('/api/auth/login', {
      method: 'POST',
      body: { username: usuario.username, password: CLAVE },
    });
    return pedir('/api/auth/2fa/challenge', {
      method: 'POST',
      body: { temp_token: login.datos.temp_token, code: codigo },
    });
  };

  return { usuario, secreto, codigosDeRespaldo, responderDesafio };
}

describe('códigos de respaldo', () => {
  test('se entregan ocho, con el formato que ve el usuario', async () => {
    const { codigosDeRespaldo } = await conDosFactores('bk1');
    assert.equal(codigosDeRespaldo.length, 8);
    for (const codigo of codigosDeRespaldo) assert.match(codigo, /^[0-9A-F]{5}-[0-9A-F]{5}$/);
  });

  test('un código inicia sesión tal cual se lo entregamos', async () => {
    const { codigosDeRespaldo, responderDesafio } = await conDosFactores('bk2');
    const r = await responderDesafio(codigosDeRespaldo[0]);
    assert.equal(r.status, 200);
    assert.equal((await pedir('/api/users/me', { token: r.datos.token })).status, 200);
  });

  test('se acepta tipeado sin guion, en minúsculas o con espacio', async () => {
    const { codigosDeRespaldo, responderDesafio } = await conDosFactores('bk3');
    const sinGuion = codigosDeRespaldo[0].replace('-', '').toLowerCase();
    const conEspacio = codigosDeRespaldo[1].replace('-', ' ');

    assert.equal((await responderDesafio(sinGuion)).status, 200);
    assert.equal((await responderDesafio(conEspacio)).status, 200);
  });

  test('un código usado no se puede reusar, y responde 401 en vez de 500', async () => {
    const { codigosDeRespaldo, responderDesafio } = await conDosFactores('bk4');
    assert.equal((await responderDesafio(codigosDeRespaldo[0])).status, 200);
    assert.equal((await responderDesafio(codigosDeRespaldo[0])).status, 401);
  });

  test('un código inventado o basura no numérica dan 401, nunca 500', async () => {
    const { responderDesafio } = await conDosFactores('bk5');
    assert.equal((await responderDesafio('ZZZZZ-ZZZZZ')).status, 401);
    // Este era el que reventaba: al no matchear caía al camino del TOTP y
    // otplib tiraba con un código no numérico.
    assert.equal((await responderDesafio('no-es-codigo')).status, 401);
  });

  test('los ocho sirven una vez cada uno, y después ninguno', async () => {
    const { codigosDeRespaldo, responderDesafio } = await conDosFactores('bk6');
    for (const codigo of codigosDeRespaldo) {
      assert.equal((await responderDesafio(codigo)).status, 200, `falló el código ${codigo}`);
    }
    assert.equal((await responderDesafio(codigosDeRespaldo[7])).status, 401);
  });

  test('el TOTP del autenticador sigue funcionando en paralelo', async () => {
    const { secreto, responderDesafio } = await conDosFactores('bk7');
    assert.equal((await responderDesafio(await totp.generate({ secret: secreto }))).status, 200);
    assert.equal((await responderDesafio('000000')).status, 401);
  });

  test('regenerar emite ocho nuevos, distintos y usables', async () => {
    const { usuario, secreto, codigosDeRespaldo, responderDesafio } = await conDosFactores('bk8');

    // Hace falta una sesión completa para poder regenerar.
    const sesion = await responderDesafio(await totp.generate({ secret: secreto }));
    const nuevos = await pedir('/api/auth/2fa/backup-codes/regenerate', {
      method: 'POST',
      token: sesion.datos.token,
      body: { code: await totp.generate({ secret: secreto }) },
    });

    assert.equal(nuevos.status, 200);
    assert.equal(nuevos.datos.backup_codes.length, 8);
    assert.ok(!nuevos.datos.backup_codes.some((c: string) => codigosDeRespaldo.includes(c)));
    assert.equal((await responderDesafio(nuevos.datos.backup_codes[0])).status, 200);
    assert.ok(usuario.id);
  });
});

describe('2FA de usuarios sin credenciales locales', () => {
  /**
   * Un usuario aprovisionado por SCIM no tiene fila en `user_credentials`, igual
   * que uno de LDAP u OIDC. Los cuatro endpoints de 2FA lo leían con `creds!` y
   * devolvían 500; tienen que responder un error de aplicación.
   */
  test('los endpoints de 2FA no revientan con un usuario sin credenciales', async () => {
    const creado = await scimService.create({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: 'sincreds' + Date.now().toString(36),
      displayName: 'Sin Credenciales',
      active: true,
    } as any);

    const esErrorDeApp = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        return 'no tiró nada';
      } catch (err) {
        return err instanceof AppError ? 'AppError' : `${(err as Error).constructor.name}`;
      }
    };

    assert.equal(await esErrorDeApp(() => authService.enableTotp(creado.id, '123456')), 'AppError');
    assert.equal(await esErrorDeApp(() => authService.disableTotp(creado.id, 'x', '123456')), 'AppError');
    assert.equal(await esErrorDeApp(() => authService.regenerateBackupCodes(creado.id, '123456')), 'AppError');
    assert.equal(
      await esErrorDeApp(() => authService.setupTotp('00000000-0000-0000-0000-000000000000')),
      'AppError',
    );
  });
});
