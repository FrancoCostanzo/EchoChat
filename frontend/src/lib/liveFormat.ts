/**
 * Live inline-formatting for the message composer (WhatsApp-style): turns
 * raw markdown-ish text into an HTML string where the delimiters are kept
 * (dimmed) and the wrapped text is actually rendered bold/italic/struck/mono,
 * right inside the input — no separate preview pane.
 *
 * Rendering here must be a pure visual overlay: every character of `text`
 * still ends up in exactly one text node, in the same order, so reading
 * `el.textContent` back out always returns the original raw string.
 */

const TOKEN_RE =
  /```(?<fenceLang>[a-zA-Z0-9_+-]*)\n(?<fenceBody>[\s\S]*?)```|`(?<code>[^`\n]+)`|\*\*(?<bold>[^\n]+?)\*\*|~~(?<strike>[^\n]+?)~~|\*(?<italic>[^\n*]+?)\*/g;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const MARK_CLASS = 'opacity-45';

function mark(text: string): string {
  return `<span class="${MARK_CLASS}">${escapeHtml(text)}</span>`;
}

function renderToken(match: RegExpExecArray): string {
  const { fenceLang, fenceBody, code, bold, strike, italic } = match.groups as Record<string, string | undefined>;

  if (fenceBody !== undefined) {
    const prefix = '```' + fenceLang + '\n';
    return (
      mark(prefix) +
      `<span class="block my-0.5 rounded-md bg-black/25 px-2 py-1 font-mono text-[13px] whitespace-pre-wrap">${escapeHtml(fenceBody)}</span>` +
      mark('```')
    );
  }
  if (code !== undefined) {
    return (
      mark('`') +
      `<code class="rounded px-1 py-0.5 font-mono text-[13px] bg-black/20">${escapeHtml(code)}</code>` +
      mark('`')
    );
  }
  if (bold !== undefined) {
    return mark('**') + `<strong class="font-semibold">${escapeHtml(bold)}</strong>` + mark('**');
  }
  if (strike !== undefined) {
    return mark('~~') + `<del class="line-through opacity-85">${escapeHtml(strike)}</del>` + mark('~~');
  }
  return mark('*') + `<em class="italic">${escapeHtml(italic ?? '')}</em>` + mark('*');
}

/** Builds the innerHTML for the composer from raw markdown-ish text. */
export function renderLiveFormatHtml(text: string | null | undefined): string {
  if (!text) return '';
  let html = '';
  let lastIndex = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text))) {
    if (m.index > lastIndex) html += escapeHtml(text.slice(lastIndex, m.index));
    html += renderToken(m);
    lastIndex = m.index + m[0].length;
  }
  html += escapeHtml(text.slice(lastIndex));
  return html;
}
