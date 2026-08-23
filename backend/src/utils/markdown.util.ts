const MARKDOWN_PATTERNS = [
  /\*\*.+?\*\*/,
  /~~.+?~~/,
  /`[^`\n]+`/,
  /```[\s\S]+?```/,
  /\[[^\]]+\]\([^)]+\)/,
  /^#{1,6}\s/m,
  /(?:^|\s)\*[^*\n]+\*(?:\s|$)/m,
];

export type BodyFormat = 'plain' | 'markdown';

export function hasMarkdownSyntax(text: unknown): boolean {
  if (!text || typeof text !== 'string') return false;
  return MARKDOWN_PATTERNS.some((pattern) => pattern.test(text));
}

export function resolveBodyFormat(body: unknown, explicitFormat?: string | null): string {
  if (explicitFormat && explicitFormat !== 'plain') return explicitFormat;
  return hasMarkdownSyntax(body) ? 'markdown' : 'plain';
}
