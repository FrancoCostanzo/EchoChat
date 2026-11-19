import { t, type Idioma } from '../i18n';

/**
 * Plantillas de email. HTML simple con estilos en línea (lo único que respetan
 * todos los clientes de correo) más una versión en texto plano.
 *
 * Todo lo que viene de usuarios (nombres, títulos de chats) se escapa: un
 * nombre de grupo no puede inyectar HTML en el correo de otro.
 */

export type EmailTemplate =
  | 'passwordReset'
  | 'invite'
  | 'security'
  | 'pending'
  | 'unread'
  | 'digest'
  | 'test';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Lo común a todas: a quién saludar y los links del pie. */
interface BaseData {
  name?: string;
  appUrl: string;
  /** Link de baja con token (en los avisos; no en recuperación ni seguridad). */
  unsubscribeUrl?: string;
}

export interface TemplateData extends BaseData {
  url?: string;
  minutes?: number;
  hours?: number;
  inviter?: string;
  username?: string;
  /** security */
  kind?: 'newLogin' | 'passwordChanged' | 'passwordReset' | '2faDisabled';
  device?: string;
  time?: string;
  /** pending: avisos ya traducidos */
  items?: string[];
  /** unread / digest */
  conversations?: { name: string; count: number }[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COLORS = { bg: '#f4f5f8', card: '#ffffff', text: '#1d1f27', muted: '#6b6f80', accent: '#5b6cff' };

function layout(idioma: Idioma, data: BaseData, blocks: { html: string; text: string }[]): { html: string; text: string } {
  const greeting = data.name ? t(idioma, 'email.greeting', { name: data.name }) : '';
  const settingsUrl = `${data.appUrl}/settings/notifications`;
  const footerLinks = [
    `<a href="${escapeHtml(settingsUrl)}" style="color:${COLORS.muted}">${escapeHtml(t(idioma, 'email.manage'))}</a>`,
    data.unsubscribeUrl
      ? `<a href="${escapeHtml(data.unsubscribeUrl)}" style="color:${COLORS.muted}">${escapeHtml(t(idioma, 'email.unsubscribe'))}</a>`
      : null,
  ].filter(Boolean).join(' · ');

  const html = `<!doctype html>
<html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${COLORS.card};border-radius:14px;padding:28px">
<tr><td style="font-size:18px;font-weight:700;color:${COLORS.accent};padding-bottom:18px">EchoChat</td></tr>
${greeting ? `<tr><td style="font-size:15px;padding-bottom:12px">${escapeHtml(greeting)}</td></tr>` : ''}
${blocks.map((b) => `<tr><td style="font-size:15px;line-height:1.55;padding-bottom:14px">${b.html}</td></tr>`).join('\n')}
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
<tr><td style="font-size:12px;color:${COLORS.muted};padding:16px 8px;text-align:center;line-height:1.6">
${escapeHtml(t(idioma, 'email.footer'))}<br>${footerLinks}
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    greeting,
    ...blocks.map((b) => b.text),
    '—',
    t(idioma, 'email.footer'),
    `${t(idioma, 'email.manage')}: ${settingsUrl}`,
    data.unsubscribeUrl ? `${t(idioma, 'email.unsubscribe')}: ${data.unsubscribeUrl}` : '',
  ].filter(Boolean).join('\n\n');

  return { html, text };
}

const paragraph = (text: string) => ({ html: escapeHtml(text), text });

const muted = (text: string) => ({
  html: `<span style="font-size:13px;color:${COLORS.muted}">${escapeHtml(text)}</span>`,
  text,
});

const button = (label: string, url: string) => ({
  html: `<a href="${escapeHtml(url)}" style="display:inline-block;background:${COLORS.accent};color:#fff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:9px">${escapeHtml(label)}</a>`,
  text: `${label}: ${url}`,
});

const list = (items: string[]) => ({
  html: `<ul style="margin:0;padding-left:20px">${items.map((i) => `<li style="padding:2px 0">${escapeHtml(i)}</li>`).join('')}</ul>`,
  text: items.map((i) => `• ${i}`).join('\n'),
});

export function renderEmail(template: EmailTemplate, idioma: Idioma, data: TemplateData): RenderedEmail {
  const k = (key: string, params: Record<string, string | number> = {}) => t(idioma, `email.${template}.${key}`, params);
  const appUrl = data.appUrl;
  let subject: string;
  let blocks: { html: string; text: string }[];

  switch (template) {
    case 'passwordReset':
      subject = k('subject');
      blocks = [
        paragraph(k('intro')),
        button(k('cta'), data.url ?? appUrl),
        muted(k('expires', { minutes: data.minutes ?? 30 })),
        muted(t(idioma, 'email.ignore')),
      ];
      break;
    case 'invite':
      subject = k('subject', { inviter: data.inviter ?? '' });
      blocks = [
        paragraph(k('intro', { inviter: data.inviter ?? '', username: data.username ?? '' })),
        button(k('cta'), data.url ?? appUrl),
        muted(k('expires', { hours: data.hours ?? 72 })),
      ];
      break;
    case 'security':
      subject = k('subject');
      blocks = [
        paragraph(k(data.kind ?? 'passwordChanged', { device: data.device ?? '' })),
        muted(k('when', { time: data.time ?? '' })),
        paragraph(k('notYou')),
      ];
      break;
    case 'pending':
      subject = k('subject', { count: data.items?.length ?? 0 });
      blocks = [paragraph(k('intro')), list(data.items ?? []), button(k('cta'), appUrl)];
      break;
    case 'unread':
    case 'digest':
      subject = k('subject');
      blocks = [
        paragraph(k('intro')),
        list((data.conversations ?? []).map((c) =>
          t(idioma, 'email.unread.item', { name: c.name, count: c.count }))),
        button(k('cta'), appUrl),
      ];
      break;
    case 'test':
      subject = k('subject');
      blocks = [paragraph(k('body'))];
      break;
  }

  return { subject, ...layout(idioma, data, blocks) };
}
