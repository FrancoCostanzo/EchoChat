import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MENTION_HREF_PREFIX, remarkMentions, segmentarMenciones } from '@/lib/mentions';
import type { MessageBodyFormat, MessageMention } from '@/types/message';

type MessageVariant = 'own' | 'other';

/**
 * Chip de @mención.
 *
 * Todo sólido a propósito: sobre fondos con degradado y wallpaper, un chip
 * translúcido toma el color de lo que tenga atrás y termina ilegible. La
 * mención al usuario logueado va con fondo lleno para que salte al barrer un
 * canal; las demás, sólo texto en color pleno.
 */
function mentionClass(esPropia: boolean, isOwn: boolean): string {
  const base = 'rounded px-1 font-semibold';
  if (esPropia) {
    // En la burbuja propia el fondo YA es el degradado accent: un chip accent
    // ahí desaparecería, así que se invierte a superficie oscura sólida.
    return `${base} ${isOwn ? 'bg-ink-900 text-white' : 'bg-accent text-accent-foreground'}`;
  }
  // En la burbuja propia el texto ya es echo-on-accent: el color no alcanza para
  // distinguir la mención, así que la marca es un subrayado sólido (sin alpha).
  return `${base} ${isOwn ? 'echo-on-accent underline decoration-2 underline-offset-2' : 'text-accent'}`;
}

function buildMarkdownComponents(variant: MessageVariant, currentUserId?: string | null): Components {
  const isOwn = variant === 'own';
  // Links sit directly on the own-bubble gradient with no darkening card
  // behind them, so they need the SAME accent-foreground pairing the bubble
  // itself uses (echo-on-accent) — not a hardcoded white. --accent-foreground
  // picks near-black for the three brightest accents (green/orange/cyan)
  // specifically because white fails there (measured as low as 2.1:1); a
  // hardcoded white link ignored that and was unreadable for exactly those
  // three, on every own message that included a link.
  const linkClass = isOwn
    ? 'underline echo-on-accent hover:opacity-80'
    : 'underline text-accent hover:opacity-80';
  // Code chips stay white-on-black regardless of accent (like CodeMessage's
  // console card) rather than switching to accent-foreground: the near-black
  // eclipse foreground would sit on this ALSO-near-black chip and disappear.
  // The overlay is darker than it used to be (25/30% black) because white
  // text still fell short of AA against the three brightest accents even
  // with the old overlay (as low as 3.4:1) — 40/45% clears all seven with
  // margin at the gradient's brightest point.
  const codeClass = isOwn
    ? 'rounded px-1 py-0.5 font-mono text-[13px] bg-black/40 text-white/95'
    : 'rounded px-1 py-0.5 font-mono text-[13px] bg-black/20 text-ink-50';
  const preClass = isOwn
    ? 'my-1 overflow-x-auto rounded-md bg-black/45 p-2 font-mono text-[13px] text-white/95'
    : 'my-1 overflow-x-auto rounded-md bg-black/25 p-2 font-mono text-[13px] text-ink-50';

  return {
    p: ({ children }) => (
      <p className="mb-1 wrap-break-word text-[15px] leading-[1.4] last:mb-0">{children}</p>
    ),
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="line-through opacity-85">{children}</del>,
    a: ({ href, children }) => {
      // Las menciones llegan acá como links `mention:<uuid>` que inyecta
      // remarkMentions — se pintan como chip, no como enlace navegable.
      if (href?.startsWith(MENTION_HREF_PREFIX)) {
        const userId = href.slice(MENTION_HREF_PREFIX.length);
        return (
          <span className={mentionClass(!!currentUserId && userId === currentUserId, isOwn)}>
            {children}
          </span>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {children}
        </a>
      );
    },
    code: ({ className, children }) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        // Block code already sits inside <pre> (background/padding come from
        // preClass below) — no need for the inline pill styling here too.
        return <code className="font-mono text-[13px]">{children}</code>;
      }
      return <code className={codeClass}>{children}</code>;
    },
    pre: ({ children }) => <pre className={preClass}>{children}</pre>,
    ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
    ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
    li: ({ children }) => <li className="text-[15px] leading-[1.4]">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote
        className={[
          'my-1 border-l-[3px] pl-2 opacity-90',
          isOwn ? 'border-white/50' : 'border-accent/70',
        ].join(' ')}
      >
        {children}
      </blockquote>
    ),
  };
}

interface MessageBodyProps {
  body?: string | null;
  bodyFormat?: MessageBodyFormat;
  variant?: MessageVariant;
  className?: string;
  size?: 'sm' | 'md';
  /** Menciones resueltas por el backend (metadata.mentions). */
  mentions?: MessageMention[];
  /** Para resaltar distinto la mención al propio usuario. */
  currentUserId?: string | null;
}

export default function MessageBody({
  body,
  bodyFormat = 'plain',
  variant = 'other',
  className = '',
  size = 'md',
  mentions = [],
  currentUserId = null,
}: MessageBodyProps) {
  if (!body) return null;

  const format = bodyFormat === 'markdown' ? 'markdown' : 'plain';
  const textSize = size === 'sm' ? 'text-[14px]' : 'text-[15px]';

  if (format !== 'markdown') {
    const segmentos = mentions.length > 0 ? segmentarMenciones(body, mentions) : null;
    return (
      <p className={['wrap-break-word whitespace-pre-wrap leading-[1.4]', textSize, className].filter(Boolean).join(' ')}>
        {segmentos
          ? segmentos.map((seg, i) => (seg.mencion ? (
              <span
                key={i}
                className={mentionClass(!!currentUserId && seg.mencion.user_id === currentUserId, variant === 'own')}
              >
                {seg.texto}
              </span>
            ) : (
              <span key={i}>{seg.texto}</span>
            )))
          : body}
      </p>
    );
  }

  return (
    <div
      className={[
        'message-body-md min-w-0 wrap-break-word leading-[1.4]',
        textSize,
        className,
      ].filter(Boolean).join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={mentions.length > 0 ? [remarkGfm, remarkMentions(mentions)] : [remarkGfm]}
        disallowedElements={['script', 'iframe', 'object', 'embed', 'form', 'input']}
        unwrapDisallowed
        components={buildMarkdownComponents(variant, currentUserId)}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
