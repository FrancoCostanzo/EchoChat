/** Patterns for inline/block markdown used by the composer toolbar. */
const MARKDOWN_PATTERNS = [
  /\*\*.+?\*\*/,
  /~~.+?~~/,
  /`[^`\n]+`/,
  /```[\s\S]+?```/,
  /\[[^\]]+\]\([^)]+\)/,
  /^#{1,6}\s/m,
  /(?:^|\s)\*[^*\n]+\*(?:\s|$)/m,
];

export function hasMarkdownSyntax(text) {
  if (!text || typeof text !== 'string') return false;
  return MARKDOWN_PATTERNS.some((pattern) => pattern.test(text));
}

/** Returns `markdown` when the body contains formatting syntax, else `plain`. */
export function detectBodyFormat(body, explicitFormat) {
  if (explicitFormat && explicitFormat !== 'plain') return explicitFormat;
  return hasMarkdownSyntax(body) ? 'markdown' : 'plain';
}
