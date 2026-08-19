/**
 * Wraps the current textarea selection with markdown delimiters.
 * Returns the new value and cursor range for the inner text.
 */
export function wrapSelection(textarea, prefix, suffix, placeholder = 'texto') {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value ?? '';
  const selected = value.slice(start, end);
  const inner = selected || placeholder;
  const wrapped = `${prefix}${inner}${suffix}`;
  const newValue = value.slice(0, start) + wrapped + value.slice(end);
  return {
    newValue,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + inner.length,
  };
}

export function applyWrap(textarea, prefix, suffix, onChange, placeholder) {
  const { newValue, selectionStart, selectionEnd } = wrapSelection(
    textarea,
    prefix,
    suffix,
    placeholder,
  );
  onChange(newValue);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
  });
}

/**
 * Code formatting is context-sensitive: a single backtick can't hold a
 * newline (it renders as literal text, not code), so a multi-line selection
 * is wrapped as a fenced block instead of silently producing broken markdown.
 */
export function applyCodeWrap(textarea, onChange, placeholder) {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const selected = (textarea.value ?? '').slice(start, end);
  const isMultiline = selected.includes('\n');
  const prefix = isMultiline ? '```\n' : '`';
  const suffix = isMultiline ? '\n```' : '`';
  applyWrap(textarea, prefix, suffix, onChange, placeholder);
}
