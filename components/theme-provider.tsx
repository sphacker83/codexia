"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_THEME_ID,
  isThemeId,
  THEME_MAP,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/theme/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  themes: typeof THEME_OPTIONS;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(themeId: ThemeId): void {
  const theme = THEME_MAP[themeId];
  const root = document.documentElement;

  root.dataset.theme = themeId;
  for (const [key, value] of Object.entries(theme.variables)) {
    root.style.setProperty(key, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && isThemeId(savedTheme) && savedTheme !== theme) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
      return;
    }
    applyTheme(theme);
    // mount 시 로컬 저장 테마를 1회 동기화하기 위한 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (themeId: ThemeId) => {
    setThemeState(themeId);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(themeId);
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: THEME_OPTIONS,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
