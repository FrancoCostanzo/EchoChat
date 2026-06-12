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
