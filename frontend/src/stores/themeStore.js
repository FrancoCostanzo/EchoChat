import { create } from 'zustand';

const STORAGE_KEY = 'echochat-theme';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode) {
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function loadPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { mode: 'system', accent: 'blurple' };
}

function savePreference(pref) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}

const initial = loadPreference();
applyTheme(initial.mode);
document.documentElement.setAttribute('data-accent', initial.accent);

export const ACCENT_COLORS = [
  { key: 'blurple', label: 'Blurple',  color: '#5865F2' },
  { key: 'blue',    label: 'Azul',     color: '#006FEE' },
  { key: 'violet',  label: 'Violeta',  color: '#7828C8' },
  { key: 'green',   label: 'Verde',    color: '#23A55A' },
  { key: 'rose',    label: 'Rosa',     color: '#F31260' },
  { key: 'orange',  label: 'Naranja',  color: '#F5A524' },
  { key: 'cyan',    label: 'Cian',     color: '#06B7DB' },
];

export const useThemeStore = create((set, get) => ({
  mode: initial.mode,
  accent: initial.accent,

  setMode: (mode) => {
    applyTheme(mode);
    set({ mode });
    savePreference({ mode, accent: get().accent });
  },

  setAccent: (accent) => {
    document.documentElement.setAttribute('data-accent', accent);
    set({ accent });
    savePreference({ mode: get().mode, accent });
  },

  init: () => {
    const { mode } = get();
    applyTheme(mode);

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  },
}));
