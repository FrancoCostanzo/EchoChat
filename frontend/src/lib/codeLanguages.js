/** Maps common aliases to react-syntax-highlighter language ids. */
const LANGUAGE_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  text: 'plaintext',
  plain: 'plaintext',
  cs: 'csharp',
  'c#': 'csharp',
  cpp: 'cpp',
  c: 'c',
};

export const CODE_LANGUAGES = [
  { id: 'plaintext', labelKey: 'code.lang.plaintext' },
  { id: 'javascript', labelKey: 'code.lang.javascript' },
  { id: 'typescript', labelKey: 'code.lang.typescript' },
  { id: 'python', labelKey: 'code.lang.python' },
  { id: 'sql', labelKey: 'code.lang.sql' },
  { id: 'json', labelKey: 'code.lang.json' },
  { id: 'bash', labelKey: 'code.lang.bash' },
  { id: 'html', labelKey: 'code.lang.html' },
  { id: 'css', labelKey: 'code.lang.css' },
  { id: 'java', labelKey: 'code.lang.java' },
  { id: 'go', labelKey: 'code.lang.go' },
  { id: 'rust', labelKey: 'code.lang.rust' },
  { id: 'php', labelKey: 'code.lang.php' },
  { id: 'csharp', labelKey: 'code.lang.csharp' },
  { id: 'yaml', labelKey: 'code.lang.yaml' },
  { id: 'markdown', labelKey: 'code.lang.markdown' },
];

export function normalizeLanguage(raw) {
  const key = (raw || 'plaintext').toLowerCase().trim();
  return LANGUAGE_ALIASES[key] || key || 'plaintext';
}

/** Parse ```lang\\nbody``` pasted from clipboard. */
export function parseCodeFence(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const match = trimmed.match(/^```(\w*)\r?\n([\s\S]*?)```$/);
  if (!match) return null;
  return {
    language: normalizeLanguage(match[1] || 'plaintext'),
    body: match[2].replace(/\r\n/g, '\n').trimEnd(),
  };
}

export function getCodeLanguage(message) {
  return normalizeLanguage(message?.metadata?.language || 'plaintext');
}
