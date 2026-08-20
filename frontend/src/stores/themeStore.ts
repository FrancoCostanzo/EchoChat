import { create } from 'zustand';

const STORAGE_KEY = 'echochat-theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentKey = 'blurple' | 'blue' | 'violet' | 'green' | 'rose' | 'orange' | 'cyan';

interface ThemePreference {
  mode: ThemeMode;
  accent: AccentKey;
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode: ThemeMode): void {
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function loadPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { mode: 'dark', accent: 'blurple' };
}

function savePreference(pref: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}

const initial = loadPreference();
applyTheme(initial.mode);
document.documentElement.setAttribute('data-accent', initial.accent);

export interface AccentColorOption {
  key: AccentKey;
  label: string;
  color: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  { key: 'blurple', label: 'Blurple',  color: '#5865F2' },
  { key: 'blue',    label: 'Azul',     color: '#006FEE' },
  { key: 'violet',  label: 'Violeta',  color: '#7828C8' },
  { key: 'green',   label: 'Verde',    color: '#17C964' },
  { key: 'rose',    label: 'Rosa',     color: '#F31260' },
  { key: 'orange',  label: 'Naranja',  color: '#F5A524' },
  { key: 'cyan',    label: 'Cian',     color: '#06B7DB' },
];

interface ThemeState {
  mode: ThemeMode;
  accent: AccentKey;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
  init: () => (() => void) | void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
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
