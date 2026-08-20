import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MessageBodyFormat } from '@/types/message';

type MessageVariant = 'own' | 'other';

function buildMarkdownComponents(variant: MessageVariant): Components {
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
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {children}
      </a>
    ),
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
}

export default function MessageBody({
  body,
  bodyFormat = 'plain',
  variant = 'other',
  className = '',
  size = 'md',
}: MessageBodyProps) {
  if (!body) return null;

  const format = bodyFormat === 'markdown' ? 'markdown' : 'plain';
  const textSize = size === 'sm' ? 'text-[14px]' : 'text-[15px]';

  if (format !== 'markdown') {
    return (
      <p className={['wrap-break-word whitespace-pre-wrap leading-[1.4]', textSize, className].filter(Boolean).join(' ')}>
        {body}
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
        remarkPlugins={[remarkGfm]}
        disallowedElements={['script', 'iframe', 'object', 'embed', 'form', 'input']}
        unwrapDisallowed
        components={buildMarkdownComponents(variant)}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
