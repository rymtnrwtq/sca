import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type ColorMode = 'dark' | 'light';
export type AccentColor = 'orange' | 'blue' | 'green' | 'purple' | 'rose';

interface ThemeContextType {
  colorMode: ColorMode;
  accentColor: AccentColor;
  setColorMode: (mode: ColorMode) => void;
  setAccentColor: (color: AccentColor) => void;
  syncThemeFromDB: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export const ACCENT_LABELS: Record<AccentColor, string> = {
  orange: 'Оранжевый',
  blue: 'Синий',
  green: 'Зелёный',
  purple: 'Фиолетовый',
  rose: 'Розовый',
};

export const ACCENT_HEX: Record<AccentColor, string> = {
  orange: '#f97316',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  rose: '#f43f5e',
};

function applyTheme(colorMode: ColorMode, accentColor: AccentColor) {
  const html = document.documentElement;
  html.setAttribute('data-theme', colorMode);
  html.setAttribute('data-accent', accentColor);
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchThemeFromDB(): Promise<{ colorMode: ColorMode; accentColor: AccentColor } | null> {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  try {
    const res = await fetch('/api/settings', { headers: authHeader() });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.color_mode || data.accent_color) {
      return {
        colorMode: (data.color_mode as ColorMode) || 'dark',
        accentColor: (data.accent_color as AccentColor) || 'orange',
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function saveThemeToDB(colorMode: ColorMode, accentColor: AccentColor) {
  const token = localStorage.getItem('auth_token');
  if (!token) return;
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ color_mode: colorMode, accent_color: accentColor }),
    });
  } catch {}
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    return (localStorage.getItem('theme_color_mode') as ColorMode) || 'dark';
  });
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    return (localStorage.getItem('theme_accent') as AccentColor) || 'orange';
  });

  useEffect(() => {
    applyTheme(colorMode, accentColor);
  }, [colorMode, accentColor]);

  const syncThemeFromDB = useCallback(async () => {
    const theme = await fetchThemeFromDB();
    if (theme) {
      setColorModeState(theme.colorMode);
      setAccentColorState(theme.accentColor);
      localStorage.setItem('theme_color_mode', theme.colorMode);
      localStorage.setItem('theme_accent', theme.accentColor);
    }
  }, []);

  // Load from DB on mount if token present
  useEffect(() => {
    syncThemeFromDB();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem('theme_color_mode', mode);
    saveThemeToDB(mode, accentColor);
  };

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    localStorage.setItem('theme_accent', color);
    saveThemeToDB(colorMode, color);
  };

  return (
    <ThemeContext.Provider value={{ colorMode, accentColor, setColorMode, setAccentColor, syncThemeFromDB }}>
      {children}
    </ThemeContext.Provider>
  );
};
