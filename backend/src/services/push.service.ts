import jwt from 'jsonwebtoken';
import webpush, { WebPushError } from 'web-push';
import config from '../config';
import logger from '../config/logger';
import { pushSubscriptionRepository } from '../repositories';
import type { PushSubscriptionRow } from '../repositories/pushSubscription.repository';
import { BadRequestError, NotFoundError } from '../errors';
import { t, type Idioma } from '../i18n';

/** Qué texto lleva el aviso; las claves son las de `push.*` en src/i18n. */
export type PushKind =
  | 'message'
  | 'mention'
  | 'threadReply'
  | 'reaction'
  | 'incomingCall'
  | 'missedCall'
  | 'broadcast'
  | 'reminder'
  | 'joinRequest'
  | 'security'
  | 'test';

/** Lo que el despachador sabe de un aviso; el texto final lo arma `format`. */
export interface PushMessage {
  kind: PushKind;
  params?: { name?: string; chat?: string | null; emoji?: string; video?: boolean };
  /** Texto del mensaje. Sólo se manda si el usuario eligió vista previa completa. */
  preview?: string | null;
  /** Ruta de la app que abre el click (relativa al origen del frontend). */
  url: string;
  /** Avisos con el mismo tag se reemplazan en vez de apilarse (uno por chat). */
  tag?: string;
  /** Para "Marcar como leído" sin abrir la app. */
  markRead?: { conversationId: string; messageId: string };
  /** Llamada entrante: botones Atender / Rechazar. */
  call?: { callId: string };
}

export type PushPreviewMode = 'full' | 'sender' | 'none';

/** Lo que recibe el service worker (frontend/public/sw.js). */
interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
  /** Token firmado para ejecutar la acción elegida sin sesión. */
  actionToken?: string;
}

// Un aviso de llamada que llega tarde no sirve: que el servicio de push lo
// descarte si no lo pudo entregar mientras suena.
const CALL_TTL_SECONDS = 35;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const MAX_FAILURES = 5;
const ACTION_AUDIENCE = 'push-action';
const ACTION_TOKEN_TTL = '7d';

export type PushAction =
  | { act: 'read'; sub: string; conversationId: string; messageId: string }
  | { act: 'decline'; sub: string; callId: string };

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const { publicKey, privateKey, subject } = config.push;
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Invalid VAPID configuration: push disabled');
  }
  return vapidReady;
}

function truncate(text: string, max = 180): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

class PushService {
  /** ¿Hay claves VAPID? Sin ellas el canal push no existe en esta instalación. */
  isConfigured(): boolean {
    return ensureVapid();
  }

  getPublicKey(): string | null {
    return this.isConfigured() ? config.push.publicKey : null;
  }

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent: string | null,
  ) {
    if (!this.isConfigured()) throw new BadRequestError('Push notifications are not configured on this server');
    const row = await pushSubscriptionRepository.upsert(userId, {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent?.slice(0, 500) ?? null,
    });
    return toDevice(row);
  }

  async listDevices(userId: string) {
    return (await pushSubscriptionRepository.findByUser(userId)).map(toDevice);
  }

  async removeDevice(userId: string, id: string) {
    if (!(await pushSubscriptionRepository.deleteForUser(userId, id))) throw new NotFoundError('Device');
  }

  async unsubscribeEndpoint(userId: string, endpoint: string) {
    await pushSubscriptionRepository.deleteByEndpoint(endpoint, userId);
  }

  /** "Enviar prueba" desde Ajustes: va a todos los dispositivos, sin filtros de preferencias. */
  async sendTest(userId: string, idioma: Idioma): Promise<number> {
    if (!this.isConfigured()) throw new BadRequestError('Push notifications are not configured on this server');
    const payload: PushPayload = {
      title: t(idioma, 'push.test.title'),
      body: t(idioma, 'push.test.body'),
      tag: 'test',
      url: '/settings/notifications',
    };
    return this._deliver(userId, payload, DEFAULT_TTL_SECONDS, 'normal');
  }

  /**
   * Arma el texto según la privacidad elegida y lo entrega a cada dispositivo
   * del usuario. Las reglas de preferencias ya las aplicó el despachador.
   */
  async send(
    userId: string,
    message: PushMessage,
    { idioma, preview }: { idioma: Idioma; preview: PushPreviewMode },
  ): Promise<number> {
    if (!this.isConfigured()) return 0;
    const payload = this.format(userId, message, idioma, preview);
    const isCall = message.kind === 'incomingCall';
    return this._deliver(
      userId,
      payload,
      isCall ? CALL_TTL_SECONDS : DEFAULT_TTL_SECONDS,
      isCall || message.kind === 'mention' ? 'high' : 'normal',
    );
  }

  format(userId: string, message: PushMessage, idioma: Idioma, preview: PushPreviewMode): PushPayload {
    const p = message.params ?? {};
    const name = p.name || '';
    const chat = p.chat || '';

    // "Nada": ni quién ni qué. Sólo que hay algo, y el click abre la app.
    if (preview === 'none') {
      return { title: 'EchoChat', body: t(idioma, 'push.generic'), tag: message.tag, url: message.url };
    }

    let title: string;
    let body = '';
    const text = preview === 'full' && message.preview ? truncate(message.preview) : '';

    switch (message.kind) {
      case 'message':
        // En un grupo el título es el grupo y el remitente va en el cuerpo.
        title = chat || name;
        body = text
          ? (chat ? `${name}: ${text}` : text)
          : (chat ? `${name}: ${t(idioma, 'push.newMessage')}` : t(idioma, 'push.newMessage'));
        break;
      case 'mention':
        title = chat ? t(idioma, 'push.mentionIn', { name, chat }) : t(idioma, 'push.mention', { name });
        body = text;
        break;
      case 'incomingCall':
        title = t(idioma, p.video ? 'push.incomingVideoCall' : 'push.incomingCall', { name });
        body = chat;
        break;
      case 'broadcast':
        title = t(idioma, 'push.broadcast', { chat });
        body = text;
        break;
      case 'reaction':
        title = t(idioma, 'push.reaction', { name, emoji: p.emoji || '' });
        body = text;
        break;
      default:
        title = t(idioma, `push.${message.kind}`, { name, chat });
        body = text;
    }

    const payload: PushPayload = { title, body, tag: message.tag, url: message.url };

    if (message.call) {
      payload.requireInteraction = true;
      payload.actions = [
        { action: 'answer', title: t(idioma, 'push.actions.answer') },
        { action: 'decline', title: t(idioma, 'push.actions.decline') },
      ];
      payload.actionToken = this.signAction({ act: 'decline', sub: userId, callId: message.call.callId });
    } else if (message.markRead) {
      payload.actions = [
        { action: 'open', title: t(idioma, 'push.actions.reply') },
        { action: 'read', title: t(idioma, 'push.actions.markRead') },
      ];
      payload.actionToken = this.signAction({
        act: 'read',
        sub: userId,
        conversationId: message.markRead.conversationId,
        messageId: message.markRead.messageId,
      });
    }
    return payload;
  }

  // ── Acciones desde la notificación ──────────────────────────────────────
  // El service worker no tiene la sesión del usuario (vive en localStorage).
  // Cada aviso trae un token que sólo sirve para su acción puntual.

  signAction(action: PushAction): string {
    if (!config.jwt.secret) throw new Error('JWT_SECRET is not configured');
    return jwt.sign(action, config.jwt.secret, { audience: ACTION_AUDIENCE, expiresIn: ACTION_TOKEN_TTL });
  }

  verifyAction(token: string): PushAction {
    try {
      if (!config.jwt.secret) throw new Error('JWT_SECRET is not configured');
      const decoded = jwt.verify(token, config.jwt.secret, { audience: ACTION_AUDIENCE }) as PushAction;
      if (decoded.act !== 'read' && decoded.act !== 'decline') throw new Error('unknown action');
      return decoded;
    } catch {
      throw new BadRequestError('Invalid or expired action');
    }
  }

  async _deliver(userId: string, payload: PushPayload, ttl: number, urgency: 'normal' | 'high'): Promise<number> {
    const subscriptions = await pushSubscriptionRepository.findByUser(userId);
    let delivered = 0;
    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: ttl, urgency },
        );
        delivered++;
        await pushSubscriptionRepository.markDelivered(sub.id);
      } catch (err) {
        await this._handleFailure(sub, err);
      }
    }));
    return delivered;
  }

  async _handleFailure(sub: PushSubscriptionRow, err: unknown) {
    const status = err instanceof WebPushError ? err.statusCode : null;
    try {
      // 404/410: el navegador dio de baja la suscripción (permiso revocado,
      // datos borrados, app desinstalada). No vuelve: se borra.
      if (status === 404 || status === 410) {
        await pushSubscriptionRepository.deleteByEndpoint(sub.endpoint);
        return;
      }
      await pushSubscriptionRepository.markFailed(sub.id, MAX_FAILURES);
    } finally {
      logger.warn({ status, err: (err as Error).message, subscriptionId: sub.id }, 'Push delivery failed');
    }
  }
}

function toDevice(row: PushSubscriptionRow) {
  return {
    id: row.id,
    user_agent: row.user_agent,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    // Para que el navegador actual se reconozca en la lista sin exponer la URL entera.
    endpoint_tail: row.endpoint.slice(-24),
  };
}

export default new PushService();
