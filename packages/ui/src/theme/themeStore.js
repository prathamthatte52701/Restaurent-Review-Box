import { create } from 'zustand';

export const THEME_KEY = 'rrb-theme';
const MODES = ['light', 'dark', 'system'];
const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function readStoredMode() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return MODES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return mq()?.matches ? 'dark' : 'light';
}

function apply(resolved) {
  try {
    document.documentElement.setAttribute('data-theme', resolved);
  } catch { /* non-DOM env */ }
}

const initial = readStoredMode();

/** useThemeStore: { mode: 'light'|'dark'|'system', resolved: 'light'|'dark', setMode(mode) } */
export const useThemeStore = create((set) => ({
  mode: initial,
  resolved: resolveTheme(initial),
  setMode: (next) => {
    const mode = MODES.includes(next) ? next : 'system';
    try { localStorage.setItem(THEME_KEY, mode); } catch { /* private mode */ }
    const resolved = resolveTheme(mode);
    apply(resolved);
    set({ mode, resolved });
  },
}));

apply(useThemeStore.getState().resolved);

// live-update while following the OS
try {
  mq()?.addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') {
      const resolved = resolveTheme('system');
      apply(resolved);
      useThemeStore.setState({ resolved });
    }
  });
} catch { /* old browsers */ }

export { themeInitScript } from './initScript.js';
