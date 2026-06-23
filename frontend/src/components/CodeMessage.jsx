import { useState, useCallback } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { Copy, Check, Code2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getCodeLanguage } from '@/lib/codeLanguages';

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

export default function CodeMessage({ message, variant = 'other' }) {
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
        isOwn ? 'border-white/15 bg-black/30' : 'border-ink-400/40 bg-ink-900/80',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center justify-between gap-2 border-b px-2.5 py-1.5',
          isOwn ? 'border-white/10 bg-black/20' : 'border-ink-400/30 bg-ink-850/60',
        ].join(' ')}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-100">
          <Code2 size={12} className="shrink-0 opacity-80" />
          <span className="truncate">{langLabel}</span>
        </div>
        <Tooltip content={copied ? t('code.copied') : t('code.copy')} placement="top">
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={handleCopy}
            className={[
              'h-6 w-6 min-w-0',
              isOwn ? 'text-white/80 hover:text-white' : 'text-ink-100 hover:text-foreground',
            ].join(' ')}
            aria-label={copied ? t('code.copied') : t('code.copy')}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </Button>
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
