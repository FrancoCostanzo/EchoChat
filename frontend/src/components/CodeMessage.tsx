import { useState, useCallback } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { Copy, Check, Code2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getCodeLanguage } from '@/lib/codeLanguages';
import type { MessageResponse } from '@/types/message';

const highlighterStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    margin: 0,
    padding: '10px 12px',
    background: 'transparent',
    fontSize: '13px',
    lineHeight: '1.45',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};

interface CodeMessageProps {
  message: MessageResponse;
  variant?: 'own' | 'other';
}

export default function CodeMessage({ message, variant = 'other' }: CodeMessageProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const language = getCodeLanguage(message);
  const body = message.body || '';
  const isOwn = variant === 'own';

  const langLabel = t(`code.lang.${language}`, { defaultValue: language });

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [body]);

  return (
    <div
      className={[
        'min-w-[min(100%,280px)] max-w-full overflow-hidden rounded-lg border',
        // Always a dark "console" card (own tints the accent gradient dark,
        // other is a literal slate — never the ink-* scale, which flips
        // light in light theme and would leave `oneDark` syntax colors
        // painted on a near-white card). Both variants read the same white-
        // based text below, no isOwn branching needed past this point.
        isOwn ? 'border-white/15 bg-black/55' : 'border-white/10 bg-console-900',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
          <Code2 size={12} className="shrink-0 opacity-80" />
          <span className="truncate">{langLabel}</span>
        </div>
        <Tooltip>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={handleCopy}
            className="h-6 w-6 min-w-0 text-white/80 hover:text-white"
            aria-label={copied ? t('code.copied') : t('code.copy')}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </Button>
          <Tooltip.Content placement="top">
            <p>{copied ? t('code.copied') : t('code.copy')}</p>
          </Tooltip.Content>
        </Tooltip>
      </div>
      <div className="max-h-80 overflow-auto">
        <SyntaxHighlighter
          language={language === 'plaintext' ? 'text' : language}
          style={highlighterStyle}
          customStyle={{ margin: 0, background: 'transparent' }}
          wrapLongLines
          PreTag="div"
        >
          {body}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
