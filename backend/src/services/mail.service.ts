import jwt from 'jsonwebtoken';
import nodemailer, { type Transporter } from 'nodemailer';
import config from '../config';
import logger from '../config/logger';
import { emailRepository, notificationRepository, userRepository } from '../repositories';
import { BadRequestError } from '../errors';
import { idiomaDe, type Idioma } from '../i18n';
import { renderEmail, type EmailTemplate, type TemplateData } from '../emails/templates';
import { NOTIFICATION_EVENTS } from '../utils/notificationEvents';

const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 25;
/** Lo que se reserva un lote mientras se manda, para que otra instancia no lo tome. */
const LEASE_SECONDS = 300;
const UNSUBSCRIBE_AUDIENCE = 'email-unsubscribe';

/** Plantillas de avisos: llevan link de baja. Recuperación, invitación y seguridad no. */
const UNSUBSCRIBABLE: EmailTemplate[] = ['pending', 'unread', 'digest'];

let transporter: Transporter | null = null;

function formatNow(idioma: Idioma, timezone: string | null): string {
  try {
    return new Intl.DateTimeFormat(idioma, {
      dateStyle: 'long', timeStyle: 'short', timeZone: timezone || 'UTC',
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
  return transporter;
}

class MailService {
  /** ¿Hay SMTP? Sin él el canal email no existe en esta instalación. */
  isConfigured(): boolean {
    return Boolean(config.mail.host);
  }

  /**
   * Encola un email para un usuario, en su idioma. Devuelve false si no hay
   * SMTP o el usuario no tiene email (no es un error: simplemente no se manda).
   */
  async enqueueForUser(
    userId: string,
    template: EmailTemplate,
    data: Omit<TemplateData, 'appUrl' | 'name' | 'unsubscribeUrl'> = {},
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const [user, settings] = await Promise.all([
      userRepository.findById(userId),
      notificationRepository.findSettings(userId),
    ]);
    if (!user?.email || user.status === 'deleted') return false;
    await emailRepository.enqueue({
      userId,
      to: user.email,
      template,
      locale: idiomaDe(settings?.email_locale ?? user.locale),
      data: {
        ...data,
        name: user.display_name,
        // Las alertas dicen cuándo pasó, en la hora y el idioma del usuario.
        ...(template === 'security' && !data.time
          ? { time: formatNow(idiomaDe(settings?.email_locale ?? user.locale), user.timezone) }
          : {}),
      },
    });
    return true;
  }

  /** Lo llama el job: manda un lote de la cola con reintentos y espera creciente. */
  async processQueue(): Promise<{ sent: number; failed: number }> {
    if (!this.isConfigured()) return { sent: 0, failed: 0 };
    const batch = await emailRepository.claimPending(BATCH_SIZE, LEASE_SECONDS);
    let sent = 0;
    let failed = 0;
    for (const row of batch) {
      try {
        const data = (row.data ?? {}) as Omit<TemplateData, 'appUrl'>;
        await this._send(row.to_address, row.template as EmailTemplate, idiomaDe(row.locale), data, row.user_id);
        await emailRepository.markSent(row.id);
        sent++;
      } catch (err) {
        await emailRepository.markFailed(row.id, (err as Error).message, MAX_ATTEMPTS);
        failed++;
        logger.warn({ err: (err as Error).message, emailId: row.id, template: row.template }, 'Email send failed');
      }
    }
    return { sent, failed };
  }

  /** "Probar SMTP" del admin: manda en el momento y propaga el error para mostrarlo. */
  async sendTest(to: string, idioma: Idioma): Promise<void> {
    if (!this.isConfigured()) throw new BadRequestError('SMTP is not configured on this server');
    try {
      await this._send(to, 'test', idioma, {}, null);
    } catch (err) {
      throw new BadRequestError(`SMTP error: ${(err as Error).message}`);
    }
  }

  async listRecent(limit = 50) {
    return emailRepository.listRecent(limit);
  }

  // ── Baja con un click ──────────────────────────────────────────────────

  signUnsubscribe(userId: string): string {
    if (!config.jwt.secret) throw new Error('JWT_SECRET is not configured');
    return jwt.sign({ sub: userId }, config.jwt.secret, { audience: UNSUBSCRIBE_AUDIENCE, expiresIn: '180d' });
  }

  /**
   * Apaga los emails de avisos (no los bloqueados por el admin, que el
   * despachador manda igual) y el resumen periódico.
   */
  async unsubscribe(token: string): Promise<void> {
    let userId: string;
    try {
      if (!config.jwt.secret) throw new Error('JWT_SECRET is not configured');
      ({ sub: userId } = jwt.verify(token, config.jwt.secret, { audience: UNSUBSCRIBE_AUDIENCE }) as { sub: string });
    } catch {
      throw new BadRequestError('Invalid or expired link');
    }
    for (const event of NOTIFICATION_EVENTS) {
      if (event === 'security.alert') continue;
      await notificationRepository.upsertPreference(userId, { event_type: event, email_enabled: false });
    }
    await notificationRepository.upsertSettings(userId, { email_digest: 'off' });
    logger.info({ userId }, 'Unsubscribed from notification emails');
  }

  async _send(
    to: string,
    template: EmailTemplate,
    idioma: Idioma,
    data: Omit<TemplateData, 'appUrl'>,
    userId: string | null,
  ): Promise<void> {
    const withLinks: TemplateData = { ...data, appUrl: config.appUrl };
    const headers: Record<string, string> = {};
    if (userId && UNSUBSCRIBABLE.includes(template)) {
      const token = this.signUnsubscribe(userId);
      withLinks.unsubscribeUrl = `${config.appUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
      // RFC 8058: el cliente de correo ofrece "Darse de baja" y hace el POST solo.
      headers['List-Unsubscribe'] = `<${config.appUrl}/api/notifications/email/unsubscribe?token=${encodeURIComponent(token)}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    const { subject, html, text } = renderEmail(template, idioma, withLinks);
    await getTransporter().sendMail({ from: config.mail.from, to, subject, html, text, headers });
  }
}

export default new MailService();
