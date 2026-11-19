import logger from '../config/logger';
import { emailRepository, notificationRepository, userRepository } from '../repositories';
import { idiomaDe, t, type Idioma } from '../i18n';
import mailService from './mail.service';
import notificationService from './notification.service';
import type { DueNotificationRow, UnreadConversationRow } from '../repositories/email.repository';

/** La espera mínima configurable (las demás se filtran por usuario). */
const MIN_DELAY_MINUTES = 15;
const BATCH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function horaLocal(timezone: string | null): { hora: number; dia: number } {
  try {
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC', hour: '2-digit', weekday: 'short', hour12: false,
    }).formatToParts(new Date());
    const hora = Number(partes.find((p) => p.type === 'hour')?.value) % 24;
    const dia = DIAS[partes.find((p) => p.type === 'weekday')?.value ?? ''];
    if (Number.isFinite(hora) && dia !== undefined) return { hora, dia };
  } catch {
    // zona inválida
  }
  const ahora = new Date();
  return { hora: ahora.getUTCHours(), dia: ahora.getUTCDay() };
}

/** Texto de un aviso en el idioma del email (con el `notice` que guardó el despachador). */
function textoDelAviso(n: DueNotificationRow, idioma: Idioma): string {
  const notice = n.reference_data?.notice as { kind?: string; params?: Record<string, string> } | undefined;
  if (!notice?.kind) return n.title ?? '';
  const params = notice.params ?? {};
  if (notice.kind === 'mention' && params.chat) return t(idioma, 'push.mentionIn', params);
  return t(idioma, `push.${notice.kind}`, params);
}

/**
 * Emails que salen por el paso del tiempo y no por una acción puntual:
 * avisos que siguen sin leer, chats con mensajes sin leer y el resumen
 * periódico. Los dispara el job `email-notices`.
 */
class EmailNoticesService {
  /** Notificaciones (menciones, llamadas perdidas…) cuyo email venció sin que se leyeran. */
  async sendPendingNotices(): Promise<number> {
    if (!mailService.isConfigured()) return 0;
    const due = await emailRepository.takeDueNotifications(BATCH);
    const porUsuario = new Map<string, DueNotificationRow[]>();
    for (const n of due) porUsuario.set(n.recipient_id, [...(porUsuario.get(n.recipient_id) ?? []), n]);

    let enviados = 0;
    for (const [userId, avisos] of porUsuario) {
      const idioma = await this._idiomaDe(userId);
      const items = avisos.map((n) => textoDelAviso(n, idioma)).filter(Boolean);
      if (items.length === 0) continue;
      if (await mailService.enqueueForUser(userId, 'pending', { items })) enviados++;
    }
    return enviados;
  }

  /**
   * Chats con mensajes sin leer hace más de la espera elegida, si el usuario
   * pidió email para ese tipo de chat. Un solo email por chat hasta que lo lea.
   */
  async sendUnreadConversations(): Promise<number> {
    if (!mailService.isConfigured()) return 0;
    const filas = await emailRepository.findUnreadConversations(MIN_DELAY_MINUTES, BATCH);
    const porUsuario = new Map<string, UnreadConversationRow[]>();
    for (const f of filas) porUsuario.set(f.user_id, [...(porUsuario.get(f.user_id) ?? []), f]);

    let enviados = 0;
    for (const [userId, chats] of porUsuario) {
      const settings = await notificationService.getSettings(userId);
      const limite = Date.now() - settings.email_unread_delay_minutes * 60 * 1000;
      const vencidos = chats.filter((c) => new Date(c.oldest_unread_at).getTime() <= limite);
      const incluidos: UnreadConversationRow[] = [];
      for (const chat of vencidos) {
        const event = chat.conversation_type === 'direct' ? 'message.direct' : 'message.group';
        const decision = await notificationService.resolve(userId, event, { conversationId: chat.conversation_id });
        if (decision.email) incluidos.push(chat);
      }
      // Los vencidos quedan marcados aunque no se incluyan: sin email pedido para
      // ese chat no tiene sentido volver a evaluarlos en cada corrida.
      await emailRepository.markConversationsEmailed(userId, vencidos.map((c) => c.conversation_id));
      if (incluidos.length === 0) continue;
      const conversations = incluidos.map((c) => ({
        name: c.conversation_name || c.peer_name || 'EchoChat',
        count: c.unread,
      }));
      if (await mailService.enqueueForUser(userId, 'unread', { conversations })) enviados++;
    }
    return enviados;
  }

  /** Resumen periódico: se evalúa cada hora contra la hora local de cada usuario. */
  async sendDigests(): Promise<number> {
    if (!mailService.isConfigured()) return 0;
    const candidatos = await emailRepository.findDigestCandidates();
    let enviados = 0;
    for (const c of candidatos) {
      const ultimo = c.last_digest_at ? new Date(c.last_digest_at).getTime() : 0;
      const { hora, dia } = horaLocal(c.timezone);
      const toca =
        c.email_digest === 'hourly' ? Date.now() - ultimo > 50 * 60 * 1000
        : c.email_digest === 'daily' ? hora === c.email_digest_hour && Date.now() - ultimo > 0.8 * DAY_MS
        : c.email_digest === 'weekly' ? dia === 1 && hora === c.email_digest_hour && Date.now() - ultimo > 6 * DAY_MS
        : false;
      if (!toca) continue;

      await emailRepository.markDigestSent(c.user_id);
      const resumen = await emailRepository.unreadSummary(c.user_id);
      if (resumen.length === 0) continue;
      const conversations = resumen.map((r) => ({ name: r.name || 'EchoChat', count: r.unread }));
      if (await mailService.enqueueForUser(c.user_id, 'digest', { conversations })) enviados++;
    }
    return enviados;
  }

  async _idiomaDe(userId: string): Promise<Idioma> {
    try {
      const [user, settings] = await Promise.all([
        userRepository.findById(userId),
        notificationRepository.findSettings(userId),
      ]);
      return idiomaDe(settings?.email_locale ?? user?.locale);
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId }, 'Could not resolve email language');
      return 'es';
    }
  }
}

export default new EmailNoticesService();
