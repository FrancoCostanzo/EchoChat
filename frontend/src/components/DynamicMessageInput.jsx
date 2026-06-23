import { forwardRef, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import MessageBody from '@/components/MessageBody';
import { detectBodyFormat, hasMarkdownSyntax } from '@/lib/markdown';

const DynamicMessageInput = forwardRef(function DynamicMessageInput(
  {
    value,
    onChange,
    onKeyDown,
    onPaste,
    placeholder,
    disabled = false,
    className = '',
    size = 'md',
  },
  ref,
) {
  const { t } = useTranslation();
  const innerRef = useRef(null);
  const textSize = size === 'sm' ? 'text-[14px]' : 'text-[15px]';
  const minH = size === 'sm' ? 'min-h-[32px]' : 'min-h-[36px]';
  const maxH = size === 'sm' ? 'max-h-24' : 'max-h-32';

  const setRef = (el) => {
    innerRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, size === 'sm' ? 96 : 128)}px`;
  }, [value, size]);

  const showPreview = Boolean(value?.trim() && hasMarkdownSyntax(value));

  return (
    <div className={['flex min-w-0 flex-1 flex-col', className].filter(Boolean).join(' ')}>
      <textarea
        ref={setRef}
        rows={1}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        disabled={disabled}
        placeholder={placeholder}
        className={[
          'w-full resize-none border-none bg-transparent py-2 leading-snug text-foreground shadow-none outline-none',
          'placeholder:text-ink-200 selection:bg-accent/30',
          textSize,
          minH,
          maxH,
        ].join(' ')}
        spellCheck
      />

      {showPreview && (
        <div
          className="mb-1 max-h-28 overflow-y-auto rounded-md border border-ink-400/30 bg-ink-900/40 px-2.5 py-2"
          aria-live="polite"
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-200">
            {t('chat.format.preview')}
          </p>
          <MessageBody
            body={value.trim()}
            bodyFormat={detectBodyFormat(value)}
            variant="other"
            size={size}
          />
        </div>
      )}
    </div>
  );
});

export default DynamicMessageInput;
