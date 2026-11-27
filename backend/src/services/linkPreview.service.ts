import http from 'http';
import https from 'https';
import dns from 'dns';
import net from 'net';
import config from '../config';
import logger from '../config/logger';
import { toConversation } from '../config/eventBus';
import { messageRepository } from '../repositories';

/** Lo que se guarda en `messages.link_preview` (cifrado) y ve el cliente. */
export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

/** Mensaje mínimo que hace falta para buscar la vista previa. */
interface PreviewTarget {
  id: string;
  conversation_id: string;
  type: string | null;
  body?: string | null;
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/i;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;
// Fuera de la intranet sólo se piden los puertos web: que nadie use el backend
// para sondear servicios internos con un link a host:6379.
const PUBLIC_PORTS = new Set([80, 443, 8080, 8443]);

/** Rangos que no son internet: loopback, privados, link-local, CGNAT, multicast… */
const PRIVATE = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) PRIVATE.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  PRIVATE.addSubnet(addr, prefix, 'ipv6');
}

export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return PRIVATE.check(mapped[1], 'ipv4');
  return PRIVATE.check(address, net.isIPv6(address) ? 'ipv6' : 'ipv4');
}

/** Primera URL http(s) del texto, sin la puntuación que la cierra en una oración. */
export function firstUrl(text: string | null | undefined): string | null {
  const match = text ? URL_PATTERN.exec(text) : null;
  return match ? match[0].replace(/[.,;:!?]+$/, '') : null;
}

class LinkPreviewService {
  private cache = new Map<string, { at: number; value: LinkPreview | null }>();

  /**
   * Busca la vista previa del primer link del mensaje, la guarda y avisa a la
   * conversación con `message:link_preview`. Se llama sin esperar: nunca demora
   * el envío ni lo hace fallar.
   */
  async attach(message: PreviewTarget): Promise<LinkPreview | null> {
    if (!config.linkPreview.enabled || message.type !== 'text') return null;
    const url = firstUrl(message.body);
    if (!url) return null;
    try {
      const preview = await this.get(url);
      if (!preview) return null;
      await messageRepository.setLinkPreview(message.id, preview);
      toConversation(message.conversation_id, 'message:link_preview', {
        messageId: message.id,
        conversationId: message.conversation_id,
        link_preview: preview,
      });
      return preview;
    } catch (err) {
      logger.warn({ err: (err as Error).message, messageId: message.id }, 'Link preview failed');
      return null;
    }
  }

  /** Vista previa de una URL, con caché de 24 h (también de los fallos). */
  async get(url: string): Promise<LinkPreview | null> {
    const hit = this.cache.get(url);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    let value: LinkPreview | null = null;
    try {
      const page = await this.fetchHtml(url, MAX_REDIRECTS);
      value = page ? parseHtml(page.html, page.url) : null;
    } catch (err) {
      logger.debug({ err: (err as Error).message, url }, 'Could not fetch link preview');
    }
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(url, { at: Date.now(), value });
    return value;
  }

  /** Sólo para los tests. */
  clearCache(): void {
    this.cache.clear();
  }

  private fetchHtml(rawUrl: string, redirectsLeft: number): Promise<{ html: string; url: string } | null> {
    const { allowPrivate, timeoutMs } = config.linkPreview;
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return Promise.resolve(null);
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    if (!allowPrivate && !PUBLIC_PORTS.has(port)) return Promise.resolve(null);

    // La IP se valida en el lookup del propio socket: así un DNS que cambia
    // entre la validación y la conexión (rebinding) no la saltea.
    // Node pide `all: true` cuando prueba IPv4 e IPv6 a la vez (autoSelectFamily).
    const lookup = ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err);
        const allowed = addresses.filter((a) => allowPrivate || !isPrivateAddress(a.address));
        if (allowed.length === 0) return callback(new Error(`Blocked private address for ${hostname}`));
        if (options.all) return callback(null, allowed);
        callback(null, allowed[0].address, allowed[0].family);
      });
    }) as unknown as net.LookupFunction;

    const client = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      const req = client.get(url, {
        lookup,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'EchoChatBot/1.0 (link preview)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es,en;q=0.8,pt;q=0.6',
        },
      }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return resolve(null);
          const next = new URL(res.headers.location, url).toString();
          return this.fetchHtml(next, redirectsLeft - 1).then(resolve, reject);
        }
        const type = String(res.headers['content-type'] ?? '');
        if (status !== 200 || !/text\/html|application\/xhtml/i.test(type)) {
          res.resume();
          return resolve(null);
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          chunks.push(chunk);
          // Las etiquetas que importan están en el <head>: con 512 KB alcanza.
          if (size >= MAX_BYTES) res.destroy();
        });
        const done = () => resolve({ html: Buffer.concat(chunks).toString('utf8'), url: url.toString() });
        res.on('end', done);
        res.on('close', done);
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
    });
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function clean(text: string | undefined, max: number): string | null {
  if (!text) return null;
  const value = decodeEntities(text).replace(/\s+/g, ' ').trim();
  return value ? value.slice(0, max) : null;
}

/** Open Graph / Twitter / `<title>` / `<meta name="description">`. */
export function parseHtml(html: string, pageUrl: string): LinkPreview | null {
  const head = html.slice(0, MAX_BYTES);
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\s[^>]*>/gi) ?? []) {
    const attr = (name: string) => new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
    const key = attr('property') ?? attr('name');
    const content = attr('content');
    if (!key || !content) continue;
    const k = (key[2] ?? key[3]).toLowerCase();
    if (!meta.has(k)) meta.set(k, content[2] ?? content[3]);
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];

  const title = clean(meta.get('og:title') ?? meta.get('twitter:title') ?? titleTag, 200);
  const description = clean(meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'), 400);
  if (!title && !description) return null;

  let image: string | null = null;
  const rawImage = meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image');
  if (rawImage) {
    try {
      const resolved = new URL(decodeEntities(rawImage.trim()), pageUrl);
      // Sólo https: una imagen http se bloquearía como contenido mixto.
      if (resolved.protocol === 'https:') image = resolved.toString().slice(0, 1000);
    } catch { /* URL inválida: sin imagen */ }
  }

  return {
    url: pageUrl,
    title,
    description,
    image_url: image,
    site_name: clean(meta.get('og:site_name'), 100) ?? new URL(pageUrl).hostname.replace(/^www\./, ''),
  };
}

export default new LinkPreviewService();
