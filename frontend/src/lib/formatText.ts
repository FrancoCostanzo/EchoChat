/**
 * Superficie mínima que estas funciones necesitan de un "campo de texto":
 * la satisface tanto un `<textarea>` real como el ref imperativo que expone
 * DynamicMessageInput.tsx (un contentEditable que se comporta como textarea
 * para selección/valor, pero no es un HTMLTextAreaElement de verdad).
 */
export interface TextInputHandle {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  focus(): void;
  setSelectionRange(start: number, end: number): void;
}

/**
 * Wraps the current textarea selection with markdown delimiters.
 * Returns the new value and cursor range for the inner text.
 */
interface WrapResult {
  newValue: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapSelection(
  textarea: TextInputHandle,
  prefix: string,
  suffix: string,
  placeholder = 'texto',
): WrapResult {
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

export function applyWrap(
  textarea: TextInputHandle,
  prefix: string,
  suffix: string,
  onChange: (value: string) => void,
  placeholder?: string,
): void {
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
export function applyCodeWrap(
  textarea: TextInputHandle,
  onChange: (value: string) => void,
  placeholder?: string,
): void {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const selected = (textarea.value ?? '').slice(start, end);
  const isMultiline = selected.includes('\n');
  const prefix = isMultiline ? '```\n' : '`';
  const suffix = isMultiline ? '\n```' : '`';
  applyWrap(textarea, prefix, suffix, onChange, placeholder);
}
