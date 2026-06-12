const MARKDOWN_PATTERNS = [
  /\*\*.+?\*\*/,
  /~~.+?~~/,
  /`[^`\n]+`/,
  /```[\s\S]+?```/,
  /\[[^\]]+\]\([^)]+\)/,
  /^#{1,6}\s/m,
  /(?:^|\s)\*[^*\n]+\*(?:\s|$)/m,
];

function hasMarkdownSyntax(text) {
  if (!text || typeof text !== 'string') return false;
  return MARKDOWN_PATTERNS.some((pattern) => pattern.test(text));
}

function resolveBodyFormat(body, explicitFormat) {
  if (explicitFormat && explicitFormat !== 'plain') return explicitFormat;
  return hasMarkdownSyntax(body) ? 'markdown' : 'plain';
}

module.exports = { hasMarkdownSyntax, resolveBodyFormat };
