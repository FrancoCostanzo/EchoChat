/**
 * Canal email: recuperar contraseña, invitaciones, alertas de seguridad,
 * avisos sin leer, baja con un click y las herramientas del admin.
 *
 * Nada sale a la red: se reemplaza el transporte de nodemailer por uno que
 * guarda los correos, y la cola se procesa llamando al servicio (los jobs no
 * corren en la suite).
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { levantarServidor, ADMIN, type ServidorDeTest } from './helpers/servidor';
import { crearCliente, sufijo, type Cliente } from './helpers/api';
import { CLAVE, iniciarSesion, type UsuarioDeTest } from './helpers/usuarios';
import mailService from '../src/services/mail.service';
import emailNoticesService from '../src/services/emailNotices.service';
import { pool } from '../src/config/database';

interface Correo {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

let servidor: ServidorDeTest;
let pedir: Cliente;
let correos: Correo[] = [];
const original = nodemailer.createTransport;

before(async () => {
  // Antes de levantar la app: el servicio crea el transporte la primera vez que manda.
  (nodemailer as any).createTransport = () => ({
    sendMail: async (m: Correo) => { correos.push(m); return { messageId: sufijo() }; },
  });
  servidor = await levantarServidor();
  pedir = crearCliente(servidor.base);
});
after(async () => {
  (nodemailer as any).createTransport = original;
  await servidor.cerrar();
});
beforeEach(() => { correos = []; });

/** Usuario con email (el helper común registra sin email). */
async function crearConEmail(prefijo: string): Promise<UsuarioDeTest & { email: string }> {
  const username = prefijo + sufijo();
  const email = `${username}@example.com`;
  const alta = await pedir('/api/auth/register', {
    method: 'POST', body: { username, display_name: username, password: CLAVE, email },
  });
  assert.equal(alta.status, 201);
  return { ...(await iniciarSesion(pedir, username)), email };
}

/**
 * Manda lo que haya en la cola y devuelve los correos para `to`. Algunos se
 * encolan en segundo plano (las alertas): reintenta hasta que haya `minimo`.
 */
async function bandejaDe(to: string, minimo = 1): Promise<Correo[]> {
  const hasta = Date.now() + 3000;
  let propios: Correo[] = [];
  while (Date.now() < hasta) {
    await mailService.processQueue();
    propios = correos.filter((c) => c.to === to);
    if (propios.length >= minimo) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  return propios;
}

function tokenDelLink(correo: Correo): string {
  const match = correo.text.match(/token=([A-Za-z0-9_\-%]+)/);
  assert.ok(match, 'el correo no trae un link con token');
  return decodeURIComponent(match[1]);
}

describe('recuperar contraseña', () => {
  test('flujo completo: pedir, elegir otra y entrar; el link no sirve dos veces', async () => {
    const u = await crearConEmail('reset');
    assert.equal((await pedir('/api/auth/password-reset/status')).datos.available, true);

    assert.equal((await pedir('/api/auth/password-reset/request', {
      method: 'POST', body: { identifier: u.email.toUpperCase() },
    })).status, 200);
    const [correo] = await bandejaDe(u.email);
    assert.match(correo.subject, /Restablecer/);
    assert.ok(correo.text.includes('http://echochat.test/reset-password?token='));
    // Recuperación y seguridad no llevan link de baja.
    assert.equal(correo.headers['List-Unsubscribe'], undefined);

    const token = tokenDelLink(correo);
    const info = await pedir('/api/auth/password-reset/inspect', { method: 'POST', body: { token } });
    assert.equal(info.datos.purpose, 'reset');
    assert.equal(info.datos.username, u.username);

    const nueva = 'OtraClave987!';
    assert.equal((await pedir('/api/auth/password-reset/complete', {
      method: 'POST', body: { token, password: nueva },
    })).status, 200);
    assert.equal((await pedir('/api/auth/password-reset/complete', {
      method: 'POST', body: { token, password: 'TerceraClave1!' },
    })).status, 400);

    // La sesión vieja quedó cerrada y la contraseña es la nueva.
    assert.equal((await pedir('/api/auth/me', { token: u.token })).status, 401);
    assert.equal((await pedir('/api/auth/login', {
      method: 'POST', body: { username: u.username, password: nueva },
    })).status, 200);

    const alertas = await bandejaDe(u.email, 2);
    assert.ok(alertas.some((c) => /seguridad/i.test(c.subject)), 'falta la alerta de seguridad');
  });

  test('responde igual si la cuenta no existe, y no manda nada', async () => {
    const r = await pedir('/api/auth/password-reset/request', {
      method: 'POST', body: { identifier: 'nadie' + sufijo() },
    });
    assert.equal(r.status, 200);
    await mailService.processQueue();
    assert.equal(correos.filter((c) => /Restablecer/.test(c.subject)).length, 0);
  });

  test('un token inventado no sirve', async () => {
    assert.equal((await pedir('/api/auth/password-reset/inspect', {
      method: 'POST', body: { token: 'inventado' },
    })).status, 400);
  });
});

describe('invitaciones', () => {
  test('el admin crea la cuenta sin contraseña y el usuario la activa desde el email', async () => {
    const admin = await iniciarSesion(pedir, ADMIN.username, ADMIN.password);
    const username = 'inv' + sufijo();
    const email = `${username}@example.com`;

    assert.equal((await pedir('/api/admin/users', {
      method: 'POST', token: admin.token,
      body: { username, display_name: 'Invitada', email, password: 'NoSeMandaCon1!', send_invite: true },
    })).status, 400);

    const alta = await pedir('/api/admin/users', {
      method: 'POST', token: admin.token,
      body: { username, display_name: 'Invitada', email, send_invite: true },
    });
    assert.equal(alta.status, 201);

    const [correo] = await bandejaDe(email);
    assert.match(correo.subject, /te invitó/);
    assert.ok(correo.text.includes(username));
    const token = tokenDelLink(correo);
    assert.equal((await pedir('/api/auth/password-reset/inspect', { method: 'POST', body: { token } })).datos.purpose, 'invite');

    // Reenviar invalida el link anterior.
    assert.equal((await pedir(`/api/admin/users/${alta.datos.id}/invite`, { method: 'POST', token: admin.token })).status, 200);
    const reenvio = (await bandejaDe(email, 2)).at(-1)!;
    assert.equal((await pedir('/api/auth/password-reset/inspect', { method: 'POST', body: { token } })).status, 400);

    const clave = 'ClaveElegida1!';
    assert.equal((await pedir('/api/auth/password-reset/complete', {
      method: 'POST', body: { token: tokenDelLink(reenvio), password: clave },
    })).status, 200);
    assert.equal((await pedir('/api/auth/login', { method: 'POST', body: { username, password: clave } })).status, 200);
  });
});

describe('alertas de seguridad', () => {
  test('un inicio de sesión desde otro navegador avisa por email', async () => {
    const u = await crearConEmail('sec');
    await mailService.processQueue();
    correos = [];

    assert.equal((await pedir('/api/auth/login', {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36' },
      body: { username: u.username, password: CLAVE },
    })).status, 200);
    const [alerta] = await bandejaDe(u.email);
    assert.match(alerta.subject, /seguridad/i);
    assert.ok(alerta.text.includes('Chrome / Windows'));
  });
});

describe('avisos que siguen sin leer', () => {
  test('una mención sin leer llega por email, con baja de un click que funciona', async () => {
    const ana = await crearConEmail('pend');
    const beto = await crearConEmail('pend');
    await pedir('/api/notifications/preferences', {
      method: 'PUT', token: beto.token, body: { event_type: 'message.mention', email_enabled: true },
    });
    const conv = await pedir('/api/conversations', {
      method: 'POST', token: ana.token, body: { type: 'direct', member_ids: [beto.id] },
    });
    await pedir('/api/messages', {
      method: 'POST', token: ana.token,
      body: { conversation_id: conv.datos.id, type: 'text', body: `ojo @${beto.username}` },
    });

    // Que la espera ya haya vencido, sin esperar 30 minutos de verdad.
    let pendientes = 0;
    for (let i = 0; i < 30 && pendientes === 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const { rowCount } = await pool.query(
        `UPDATE notifications SET email_due_at = NOW() - INTERVAL '1 minute'
         WHERE recipient_id = $1 AND email_due_at IS NOT NULL`,
        [beto.id],
      );
      pendientes = rowCount ?? 0;
    }
    assert.equal(pendientes, 1);

    assert.equal(await emailNoticesService.sendPendingNotices(), 1);
    const [correo] = await bandejaDe(beto.email);
    assert.match(correo.subject, /Avisos sin ver/);
    assert.ok(correo.text.includes(`${ana.username} te mencionó`));
    // Nunca el contenido del mensaje: va cifrado en reposo.
    assert.ok(!correo.text.includes('ojo'));

    // El mismo aviso no se manda dos veces.
    assert.equal(await emailNoticesService.sendPendingNotices(), 0);

    const baja = correo.headers['List-Unsubscribe'].slice(1, -1).replace('http://echochat.test', '');
    assert.equal((await pedir(baja, { method: 'POST' })).status, 200);
    const prefs = await pedir('/api/notifications/preferences', { token: beto.token });
    assert.equal(prefs.datos.events.find((e: any) => e.event_type === 'message.mention').email_enabled, false);
  });
});

describe('admin', () => {
  test('probar SMTP manda en el momento y queda en el registro', async () => {
    const admin = await iniciarSesion(pedir, ADMIN.username, ADMIN.password);
    const r = await pedir('/api/admin/email/test', {
      method: 'POST', token: admin.token, body: { to: 'prueba@example.com' },
    });
    assert.equal(r.status, 200);
    assert.equal(correos.filter((c) => c.to === 'prueba@example.com').length, 1);

    const log = await pedir('/api/admin/email/log', { token: admin.token });
    assert.equal(log.datos.configured, true);
    assert.ok(Array.isArray(log.datos.entries));
  });
});
