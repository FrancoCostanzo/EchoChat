import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { renderLiveFormatHtml } from '@/lib/liveFormat';

/* ── Plain-text ⇄ DOM caret mapping ──────────────────────────────────────
   The contentEditable holds formatted spans, but its `textContent` must
   always equal the raw markdown string. These helpers translate between a
   character offset in that raw string and a DOM (node, offset) pair so the
   caret survives a full re-render of the formatted markup. ── */
function charOffsetOfNode(root, node, nodeOffset) {
  if (node === root) {
    let offset = 0;
    for (let i = 0; i < nodeOffset && i < root.childNodes.length; i++) {
      offset += root.childNodes[i].textContent.length;
    }
    return offset;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return offset + nodeOffset;
    offset += current.textContent.length;
    current = walker.nextNode();
  }
  return offset;
}

function getSelectionOffsets(root) {
  const total = root.textContent.length;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { start: total, end: total };
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return { start: total, end: total };
  }
  return {
    start: charOffsetOfNode(root, range.startContainer, range.startOffset),
    end: charOffsetOfNode(root, range.endContainer, range.endOffset),
  };
}

function findNodeAtOffset(root, target) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode();
  let last = null;
  while (node) {
    const len = node.textContent.length;
    if (target <= offset + len) return { node, offset: target - offset };
    offset += len;
    last = node;
    node = walker.nextNode();
  }
  return last ? { node: last, offset: last.textContent.length } : null;
}

function setSelectionOffsets(root, start, end) {
  const selection = window.getSelection();
  if (!selection) return;
  const startPos = findNodeAtOffset(root, start);
  const endPos = findNodeAtOffset(root, end);
  const range = document.createRange();
  if (startPos) range.setStart(startPos.node, startPos.offset);
  else range.setStart(root, 0);
  if (endPos) range.setEnd(endPos.node, endPos.offset);
  else range.setEnd(root, 0);
  selection.removeAllRanges();
  selection.addRange(range);
}

function applyRawToDom(el, raw) {
  el.innerHTML = renderLiveFormatHtml(raw);
  if (raw) delete el.dataset.empty;
  else el.dataset.empty = 'true';
}

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
  const domRef = useRef(null);
  // Sentinel start (not the initial value) so the very first render always
  // paints, even when `value` already has text (e.g. loading a draft).
  const lastEmittedRef = useRef();
  const textSize = size === 'sm' ? 'text-[14px]' : 'text-[15px]';
  const minH = size === 'sm' ? 'min-h-[32px]' : 'min-h-[36px]';
  const maxH = size === 'sm' ? 'max-h-24' : 'max-h-32';

  const rebuildAndPlaceCaret = useCallback((raw, start, end) => {
    const el = domRef.current;
    if (!el) return;
    applyRawToDom(el, raw);
    setSelectionOffsets(el, start, end);
  }, []);

  const emitChange = useCallback((raw) => {
    lastEmittedRef.current = raw;
    onChange?.({ target: { value: raw } });
  }, [onChange]);

  // Shim exposing the textarea-like surface (`value`, `selectionStart/End`,
  // `focus`, `setSelectionRange`) that formatText.js/FormatToolbar rely on,
  // backed by the contentEditable's live selection instead of native
  // textarea properties.
  useImperativeHandle(ref, () => ({
    get value() { return domRef.current?.textContent ?? ''; },
    get selectionStart() { return domRef.current ? getSelectionOffsets(domRef.current).start : 0; },
    get selectionEnd() { return domRef.current ? getSelectionOffsets(domRef.current).end : 0; },
    focus() { domRef.current?.focus(); },
    setSelectionRange(start, end) {
      if (domRef.current) setSelectionOffsets(domRef.current, start, end);
    },
  }), []);

  // Re-render the formatted markup whenever `value` changes for a reason
  // other than the user typing in this box (send/clear, format-toolbar
  // wrap, emoji insert, draft load, edit-message load…).
  useLayoutEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    const el = domRef.current;
    if (!el) return;
    const raw = value || '';
    applyRawToDom(el, raw);
    if (document.activeElement === el) {
      setSelectionOffsets(el, raw.length, raw.length);
    }
  }, [value]);

  useLayoutEffect(() => {
    const el = domRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, size === 'sm' ? 96 : 128)}px`;
  }, [value, size]);

  const syncFromDom = useCallback(() => {
    const el = domRef.current;
    if (!el) return;
    const { start, end } = getSelectionOffsets(el);
    const raw = el.textContent;
    rebuildAndPlaceCaret(raw, start, end);
    emitChange(raw);
  }, [emitChange, rebuildAndPlaceCaret]);

  const handleInput = useCallback((e) => {
    if (e.nativeEvent?.isComposing) return;
    syncFromDom();
  }, [syncFromDom]);

  const insertAtCaret = useCallback((insertText) => {
    const el = domRef.current;
    if (!el) return;
    const { start, end } = getSelectionOffsets(el);
    const raw = el.textContent;
    const newRaw = raw.slice(0, start) + insertText + raw.slice(end);
    const caret = start + insertText.length;
    rebuildAndPlaceCaret(newRaw, caret, caret);
    emitChange(newRaw);
  }, [emitChange, rebuildAndPlaceCaret]);

  const handleKeyDown = useCallback((e) => {
    onKeyDown?.(e);
    // Textareas insert a literal newline on Shift+Enter for free; a
    // contentEditable's default (a stray <div>/<br>) would break the
    // plain-text model, so we take it over ourselves.
    if (!e.defaultPrevented && e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      insertAtCaret('\n');
    }
  }, [onKeyDown, insertAtCaret]);

  const handlePaste = useCallback((e) => {
    onPaste?.(e);
    if (e.defaultPrevented) return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    // Force plain-text paste — otherwise the browser inserts the
    // clipboard's own HTML/styling into the contentEditable.
    e.preventDefault();
    const el = domRef.current;
    if (!el) return;
    const { start, end } = getSelectionOffsets(el);
    const raw = el.textContent;
    const newRaw = raw.slice(0, start) + text + raw.slice(end);
    const caret = start + text.length;
    rebuildAndPlaceCaret(newRaw, caret, caret);
    emitChange(newRaw);
  }, [onPaste, emitChange, rebuildAndPlaceCaret]);

  return (
    <div className={['flex min-w-0 flex-1 flex-col', className].filter(Boolean).join(' ')}>
      <div
        ref={domRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        aria-disabled={disabled || undefined}
        data-placeholder={placeholder}
        tabIndex={disabled ? -1 : 0}
        spellCheck
        onInput={handleInput}
        onCompositionEnd={syncFromDom}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={[
          'echo-rich-input w-full resize-none overflow-y-auto whitespace-pre-wrap wrap-break-word border-none bg-transparent py-2 leading-snug text-foreground shadow-none outline-none',
          'selection:bg-accent/30',
          disabled ? 'cursor-not-allowed opacity-60' : '',
          textSize,
          minH,
          maxH,
        ].filter(Boolean).join(' ')}
      />
    </div>
  );
});

export default DynamicMessageInput;
