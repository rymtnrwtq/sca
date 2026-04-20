import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserTier } from '../types';
import { HISTORY_KEY, WATCH_LATER_KEY, MAX_HISTORY } from '../constants';
import type { WatchHistoryEntry, WatchLaterEntry } from '../utils/localStorage';

async function loadFromDB(token: string): Promise<void> {
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [histRes, bmRes, settingsRes] = await Promise.all([
      fetch('/api/history', { headers }),
      fetch('/api/watch-later', { headers }),
      fetch('/api/settings', { headers }),
    ]);

    if (histRes.ok) {
      const { history } = await histRes.json();
      const entries: WatchHistoryEntry[] = (history as any[]).map(r => ({
        videoId: r.video_id,
        title: r.video_title || '',
        posterUrl: r.video_poster || null,
        duration: r.video_duration || '',
        durationSec: r.video_duration_sec || 0,
        embedUrl: r.video_embed_url || '',
        lastPosition: r.last_position || 0,
        lastWatched: r.last_watched
          ? new Date(r.last_watched).getTime()
          : Date.now(),
        progress: r.progress || 0,
      }));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
      window.dispatchEvent(new CustomEvent('sca_history_update'));
    }

    if (bmRes.ok) {
      const { bookmarks } = await bmRes.json();
      const entries: WatchLaterEntry[] = (bookmarks as any[]).map(r => ({
        videoId: r.video_id,
        title: r.video_title || '',
        posterUrl: r.video_poster || null,
        duration: r.video_duration || '',
        durationSec: r.video_duration_sec || 0,
        embedUrl: r.video_embed_url || '',
        addedAt: r.added_at ? new Date(r.added_at).getTime() : Date.now(),
      }));
      localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(entries));
      window.dispatchEvent(new CustomEvent('sca_watch_later_update'));
    }

    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      if (settings.color_mode) {
        localStorage.setItem('theme_color_mode', settings.color_mode);
        document.documentElement.setAttribute('data-theme', settings.color_mode);
      }
      if (settings.accent_color) {
        localStorage.setItem('theme_accent', settings.accent_color);
        document.documentElement.setAttribute('data-accent', settings.accent_color);
      }
      window.dispatchEvent(new CustomEvent('sca_theme_update', {
        detail: { color_mode: settings.color_mode, accent_color: settings.accent_color },
      }));
    }
  } catch (e) {
    console.error('loadFromDB error', e);
  }
}

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('device_id', id);
  }
  return id;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface AuthContextType {
  user: User | null;
  tier: UserTier;
  isLoading: boolean;
  isPaywallOpen: boolean;
  setPaywallOpen: (open: boolean) => void;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string, name: string) => Promise<string | null>;
  telegramLogin: (tgUser: TelegramUser, password: string, username?: string) => Promise<string | null>;
  telegramRegister: (tgUser: TelegramUser, password: string, username: string, name?: string) => Promise<string | null>;
  logout: () => void;
  continueAsGuest: () => void;
  upgradeToPremium: () => Promise<void>;
  refreshUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  changeName: (name: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<UserTier>('guest');
  const [isLoading, setIsLoading] = useState(true);
  const [isPaywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setIsLoading(false); return; }
    fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (res.status === 401) {
          // Token explicitly rejected — clear it
          localStorage.removeItem('auth_token');
          return;
        }
        if (!res.ok) {
          // Server error or restarting — keep token, just show as loading done
          return;
        }
        const data = await res.json();
        if (data?.user) {
          setUser(data.user);
          setTier(data.user.tier);
          await loadFromDB(token);
        }
      })
      .catch(() => {
        // Network error (server restarting) — keep token, don't log out
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Re-sync from DB when tab becomes visible again (cross-device sync)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      loadFromDB(token);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Returns null on success, error message on failure
  const login = async (username: string, password: string): Promise<string | null> => {
    console.log('AuthContext: login start', { username });
    try {
      const device_id = getOrCreateDeviceId();
      console.log('AuthContext: device_id', device_id);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, device_id }),
      });

      console.log('AuthContext: response status', res.status);
      const data = await res.json();
      console.log('AuthContext: response data', data);
      if (res.ok && data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
        if (data.device_id) localStorage.setItem('device_id', data.device_id);
        setUser(data.user);
        setTier(data.user.tier);
        await loadFromDB(data.token);
        return null;
      }
      return data.message ?? 'Ошибка входа';
    } catch (err) {
      console.error('Login fetch error:', err);
      return 'Ошибка сети. Проверьте подключение к серверу.';
    }
  };

  // Returns null on success, error message on failure
  const register = async (username: string, password: string, name: string): Promise<string | null> => {
    try {
      const device_id = getOrCreateDeviceId();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, device_id }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
        if (data.device_id) localStorage.setItem('device_id', data.device_id);
        setUser(data.user);
        setTier(data.user.tier);
        await loadFromDB(data.token);
        return null;
      }
      return data.message ?? 'Ошибка регистрации';
    } catch (err) {
      console.error('Register fetch error:', err);
      return 'Ошибка сети. Проверьте подключение к серверу.';
    }
  };

  const telegramLogin = async (tgUser: TelegramUser, password: string, username?: string): Promise<string | null> => {
    try {
      const device_id = getOrCreateDeviceId();
      const res = await fetch('/api/auth/telegram-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram: tgUser, password, username, device_id }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
        if (data.device_id) localStorage.setItem('device_id', data.device_id);
        setUser(data.user);
        setTier(data.user.tier);
        await loadFromDB(data.token);
        return null;
      }
      return data.message ?? 'Ошибка входа через Telegram';
    } catch {
      return 'Ошибка сети. Проверьте подключение к серверу.';
    }
  };

  const telegramRegister = async (tgUser: TelegramUser, password: string, username: string, name?: string): Promise<string | null> => {
    try {
      const device_id = getOrCreateDeviceId();
      const res = await fetch('/api/auth/telegram-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram: tgUser, password, username, name, device_id }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
        if (data.device_id) localStorage.setItem('device_id', data.device_id);
        setUser(data.user);
        setTier(data.user.tier);
        await loadFromDB(data.token);
        return null;
      }
      return data.message ?? 'Ошибка регистрации через Telegram';
    } catch {
      return 'Ошибка сети. Проверьте подключение к серверу.';
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setTier('guest');
  };

  const continueAsGuest = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setTier('guest');
  };

  const upgradeToPremium = async (): Promise<void> => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const res = await fetch('/api/payment/mock-success', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.user) { setUser(data.user); setTier(data.user.tier); }
    } catch (err) {
      console.error('Upgrade error:', err);
    }
  };

  const refreshUser = async (): Promise<void> => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) { setUser(data.user); setTier(data.user.tier); }
      }
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<string | null> => {
    const token = localStorage.getItem('auth_token');
    if (!token) return 'Не авторизован';
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) return null;
      return data.message ?? 'Ошибка смены пароля';
    } catch {
      return 'Ошибка сети';
    }
  };

  const changeName = async (name: string): Promise<string | null> => {
    const token = localStorage.getItem('auth_token');
    if (!token) return 'Не авторизован';
    try {
      const res = await fetch('/api/change-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        return null;
      }
      return data.message ?? 'Ошибка смены имени';
    } catch {
      return 'Ошибка сети';
    }
  };

  return (
    <AuthContext.Provider value={{ user, tier, isLoading, isPaywallOpen, setPaywallOpen, login, register, telegramLogin, telegramRegister, logout, continueAsGuest, upgradeToPremium, refreshUser, changePassword, changeName }}>
      {children}
    </AuthContext.Provider>
  );
};
