import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  setDark: (dark: boolean) => void;
  toggle: () => void;
}

// Read initial value from localStorage to prevent flash
const getInitialTheme = (): boolean => {
  try {
    const stored = localStorage.getItem('fiveserv-dark-mode');
    if (stored !== null) return stored === 'true';
  } catch {}
  return true; // default dark
};

const applyTheme = (dark: boolean) => {
  const root = document.documentElement;
  if (dark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
  localStorage.setItem('fiveserv-dark-mode', String(dark));
};

// Apply immediately on load
const initialDark = getInitialTheme();
applyTheme(initialDark);

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: initialDark,
  setDark: (dark) => {
    applyTheme(dark);
    set({ isDark: dark });
  },
  toggle: () => {
    set((state) => {
      const next = !state.isDark;
      applyTheme(next);
      return { isDark: next };
    });
  },
}));
