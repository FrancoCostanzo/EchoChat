import { useCallback } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { Bold, Italic, Strikethrough, Code2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { applyWrap } from '@/lib/formatText';

const FORMAT_ACTIONS = [
  { key: 'bold', icon: Bold, prefix: '**', suffix: '**', shortcut: 'Ctrl+B' },
  { key: 'italic', icon: Italic, prefix: '*', suffix: '*', shortcut: 'Ctrl+I' },
  { key: 'strikethrough', icon: Strikethrough, prefix: '~~', suffix: '~~' },
  { key: 'code', icon: Code2, prefix: '`', suffix: '`', shortcut: 'Ctrl+E' },
];

export default function FormatToolbar({ inputRef, onChange, disabled = false }) {
  const { t } = useTranslation();

  const handleFormat = useCallback(
    (prefix, suffix, placeholderKey) => {
      const el = inputRef.current;
      if (!el || disabled) return;
      applyWrap(el, prefix, suffix, onChange, t(placeholderKey));
    },
    [inputRef, onChange, disabled, t],
  );

  return (
    <div
      className="flex items-center gap-0.5 border-b border-ink-400/25 px-1 pb-1 pt-0.5"
      role="toolbar"
      aria-label={t('chat.formatToolbar')}
    >
      {FORMAT_ACTIONS.map(({ key, icon: Icon, prefix, suffix, shortcut }) => (
        <Tooltip
          key={key}
          content={shortcut ? `${t(`chat.format.${key}`)} (${shortcut})` : t(`chat.format.${key}`)}
          placement="top"
        >
          <Button
            isIconOnly
            variant="ghost"
            isDisabled={disabled}
            onPress={() => handleFormat(prefix, suffix, 'chat.format.placeholder')}
            className="flex h-7 w-7 min-w-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
            aria-label={t(`chat.format.${key}`)}
          >
            <Icon size={15} strokeWidth={2.25} />
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}

/** Keyboard shortcuts for the message composer textarea. */
export function handleFormatShortcut(e, inputRef, onChange, t) {
  if (!e.ctrlKey && !e.metaKey) return false;
  const el = inputRef.current;
  if (!el) return false;

  const map = {
    b: ['**', '**'],
    i: ['*', '*'],
    e: ['`', '`'],
  };
  const delimiters = map[e.key.toLowerCase()];
  if (!delimiters) return false;

  e.preventDefault();
  applyWrap(el, delimiters[0], delimiters[1], onChange, t('chat.format.placeholder'));
  return true;
}
