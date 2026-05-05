import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  User as UserIcon, LogOut, Crown, Lock, Settings,
  ChevronRight, EyeOff, Eye, Shield, KeyRound, Pencil, Monitor, Trash2,
  Laptop, Smartphone, Sun, Moon, Palette, Check, Bell, BellOff,
  Send, CheckCircle2, ArrowLeft, X, ChevronDown,
} from 'lucide-react';
import { useAuth, TelegramUser } from '../contexts/AuthContext';
import { useTheme, AccentColor, ACCENT_LABELS, ACCENT_HEX, ColorMode } from '../contexts/ThemeContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { cn } from '../lib/utils';
import { TIER_LABELS, HIDDEN_VIDEOS_KEY } from '../constants';
import { TelegramLinkCard } from '../components/TelegramLinkCard';
import { PaymentHistoryCard } from '../components/PaymentHistoryCard';
import { BottomSheet } from '../components/ui/BottomSheet';
import { TelegramAuth } from '../components/TelegramAuth';

interface Device {
  id: string;
  name: string;
  last_seen: string;
  created_at: string;
}

function parseDbDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const normalized = s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

const TG_BLUE = '#229ED9';

// ── Reusable row button ───────────────────────────────────────────────────────
const SettingsRow = ({
  icon, label, sublabel, onClick, right, danger, active,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  active?: boolean;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 p-3 rounded-2xl transition-colors group text-left",
      danger ? "hover:bg-red-500/10" : "hover:bg-white/5",
    )}
  >
    <div className={cn(
      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
      active ? "bg-orange-500/20 text-orange-400" : "bg-zinc-800 text-zinc-400 group-hover:text-orange-500",
      danger && "group-hover:text-red-400 group-hover:bg-transparent",
    )}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <span className={cn("text-sm block", danger ? "text-red-400" : "text-zinc-300")}>{label}</span>
      {sublabel && <span className="text-xs text-zinc-600">{sublabel}</span>}
    </div>
    {right ?? <ChevronRight size={15} className="text-zinc-700 shrink-0" />}
  </button>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-zinc-600 text-xs font-semibold uppercase tracking-wider px-3 pt-2 pb-1">{children}</p>
);

// ── Password change form (with Telegram reset option) ─────────────────────────
const PasswordForm = ({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) => {
  const { changePassword, resetPasswordViaTelegram, resetPasswordViaToken } = useAuth();

  // normal change
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showC, setShowC] = useState(false);
  const [showN, setShowN] = useState(false);
  const [showCo, setShowCo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // telegram reset mode
  const [mode, setMode] = useState<'change' | 'tg-verify' | 'tg-newpwd'>('change');
  const [resetTgUser, setResetTgUser] = useState<TelegramUser | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [tgNewPwd, setTgNewPwd] = useState('');
  const [tgConfirmPwd, setTgConfirmPwd] = useState('');
  const [tgShowN, setTgShowN] = useState(false);
  const [tgShowCo, setTgShowCo] = useState(false);
  const [tgErrors, setTgErrors] = useState<Record<string, string>>({});
  const [tgLoading, setTgLoading] = useState(false);

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors text-sm pr-10";

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!currentPwd) errs.current = 'Введите текущий пароль';
    if (!newPwd) errs.new = 'Введите новый пароль';
    else if (newPwd.length < 8) errs.new = 'Минимум 8 символов';
    else if (!/[A-Z]/.test(newPwd)) errs.new = 'Нужна заглавная буква';
    else if (!/[0-9]/.test(newPwd)) errs.new = 'Нужна цифра';
    if (newPwd && confirmPwd && newPwd !== confirmPwd) errs.confirm = 'Пароли не совпадают';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    const err = await changePassword(currentPwd, newPwd);
    setLoading(false);
    if (err) {
      const m = err.toLowerCase();
      if (m.includes('текущий') || m.includes('неверный')) setErrors({ current: err });
      else setErrors({ general: err });
      return;
    }
    setSuccess(true);
    setTimeout(onSuccess, 1500);
  };

  const handleTgAuth = (tgUser?: TelegramUser) => {
    if (tgUser) { setResetTgUser(tgUser); setResetToken(null); }
    setMode('tg-newpwd');
  };
  const handleTgToken = (token: string) => { setResetToken(token); setResetTgUser(null); };

  const handleTgReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!tgNewPwd) errs.new = 'Введите новый пароль';
    else if (tgNewPwd.length < 8) errs.new = 'Минимум 8 символов';
    else if (!/[A-Z]/.test(tgNewPwd)) errs.new = 'Нужна заглавная буква';
    else if (!/[0-9]/.test(tgNewPwd)) errs.new = 'Нужна цифра';
    if (tgNewPwd && tgConfirmPwd && tgNewPwd !== tgConfirmPwd) errs.confirm = 'Пароли не совпадают';
    if (Object.keys(errs).length) { setTgErrors(errs); return; }
    setTgErrors({});
    setTgLoading(true);
    let err: string | null;
    if (resetTgUser) err = await resetPasswordViaTelegram(resetTgUser, tgNewPwd);
    else if (resetToken) err = await resetPasswordViaToken(resetToken, tgNewPwd);
    else err = 'Данные для сброса утеряны. Начните заново.';
    setTgLoading(false);
    if (err) { setTgErrors({ general: err }); return; }
    setSuccess(true);
    setTimeout(onSuccess, 1500);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 size={44} className="text-green-400" />
        <p className="text-white font-bold">Пароль изменён!</p>
      </div>
    );
  }

  if (mode === 'tg-verify') {
    return (
      <div className="space-y-4">
        <button onClick={() => setMode('change')} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Назад
        </button>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1" style={{ backgroundColor: `${TG_BLUE}22` }}>
            <Send size={22} style={{ color: TG_BLUE }} />
          </div>
          <p className="text-white font-bold">Подтверждение через Telegram</p>
          <p className="text-zinc-500 text-sm">Войдите в Telegram, привязанный к аккаунту</p>
        </div>
        <TelegramAuth onAuth={handleTgAuth} mode="reset" onResetToken={handleTgToken} />
      </div>
    );
  }

  if (mode === 'tg-newpwd') {
    return (
      <div className="space-y-4">
        <button onClick={() => setMode('tg-verify')} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Назад
        </button>
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center space-y-1">
          <p className="text-green-400 font-bold text-sm flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> Личность подтверждена
          </p>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Старый пароль сброшен. Придумайте новый пароль — именно он будет использоваться для входа в аккаунт. Старый пароль больше не подойдёт.
          </p>
        </div>
        <form onSubmit={handleTgReset} className="space-y-3">
          <div className="space-y-1">
            <div className="relative">
              <input type={tgShowN ? 'text' : 'password'} value={tgNewPwd} onChange={e => { setTgNewPwd(e.target.value); setTgErrors(p => ({ ...p, new: '' })); }}
                placeholder="Новый пароль" className={cn(inputClass, tgErrors.new && "border-red-500/60")} autoComplete="new-password" autoFocus />
              <button type="button" onClick={() => setTgShowN(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {tgShowN ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {tgErrors.new ? <p className="text-red-400 text-xs px-1">{tgErrors.new}</p> : (
              <ul className="text-xs space-y-0.5 px-1">
                <li className={cn(tgNewPwd.length >= 8 ? 'text-green-500' : 'text-zinc-600')}>• Минимум 8 символов</li>
                <li className={cn(/[A-Z]/.test(tgNewPwd) ? 'text-green-500' : 'text-zinc-600')}>• Заглавная буква</li>
                <li className={cn(/[0-9]/.test(tgNewPwd) ? 'text-green-500' : 'text-zinc-600')}>• Цифра</li>
              </ul>
            )}
          </div>
          <div className="relative">
            <input type={tgShowCo ? 'text' : 'password'} value={tgConfirmPwd} onChange={e => { setTgConfirmPwd(e.target.value); setTgErrors(p => ({ ...p, confirm: '' })); }}
              placeholder="Повторите пароль" className={cn(inputClass, tgErrors.confirm && "border-red-500/60")} autoComplete="new-password" />
            <button type="button" onClick={() => setTgShowCo(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              {tgShowCo ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {tgErrors.confirm && <p className="text-red-400 text-xs px-1">{tgErrors.confirm}</p>}
          {tgErrors.general && <p className="text-red-400 text-xs text-center">{tgErrors.general}</p>}
          <button type="submit" disabled={tgLoading} className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-all">
            {tgLoading ? '...' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    );
  }

  // Default: change password form
  return (
    <form onSubmit={handleChange} className="space-y-3">
      <div className="space-y-1">
        <div className="relative">
          <input type={showC ? 'text' : 'password'} value={currentPwd} onChange={e => { setCurrentPwd(e.target.value); setErrors(p => ({ ...p, current: '' })); }}
            placeholder="Текущий пароль" className={cn(inputClass, errors.current && "border-red-500/60")} autoComplete="current-password" autoFocus />
          <button type="button" onClick={() => setShowC(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            {showC ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.current && <p className="text-red-400 text-xs px-1">{errors.current}</p>}
        <button type="button" onClick={() => setMode('tg-verify')}
          className="flex items-center gap-2 mt-1 px-3 py-2 rounded-xl bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/20 hover:border-[#229ED9]/40 text-[#229ED9] text-xs font-medium transition-all w-full justify-center">
          <Send size={12} /> Забыл пароль — сбросить через Telegram
        </button>
      </div>
      <div className="space-y-1">
        <div className="relative">
          <input type={showN ? 'text' : 'password'} value={newPwd} onChange={e => { setNewPwd(e.target.value); setErrors(p => ({ ...p, new: '' })); }}
            placeholder="Новый пароль" className={cn(inputClass, errors.new && "border-red-500/60")} autoComplete="new-password" />
          <button type="button" onClick={() => setShowN(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            {showN ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.new ? <p className="text-red-400 text-xs px-1">{errors.new}</p> : (
          <ul className="text-xs space-y-0.5 px-1">
            <li className={cn(newPwd.length >= 8 ? 'text-green-500' : 'text-zinc-600')}>• Минимум 8 символов</li>
            <li className={cn(/[A-Z]/.test(newPwd) ? 'text-green-500' : 'text-zinc-600')}>• Заглавная буква</li>
            <li className={cn(/[0-9]/.test(newPwd) ? 'text-green-500' : 'text-zinc-600')}>• Цифра</li>
          </ul>
        )}
      </div>
      <div className="relative">
        <input type={showCo ? 'text' : 'password'} value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setErrors(p => ({ ...p, confirm: '' })); }}
          placeholder="Повторите новый пароль" className={cn(inputClass, errors.confirm && "border-red-500/60")} autoComplete="new-password" />
        <button type="button" onClick={() => setShowCo(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
          {showCo ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {errors.confirm && <p className="text-red-400 text-xs px-1">{errors.confirm}</p>}
      {errors.general && <p className="text-red-400 text-xs text-center">{errors.general}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl font-medium text-sm transition-all">
          Отмена
        </button>
        <button type="submit" disabled={loading} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-all">
          {loading ? '...' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
};

// ── Name change form ──────────────────────────────────────────────────────────
const NameForm = ({ user, onSuccess, onCancel }: { user: any; onSuccess: () => void; onCancel: () => void }) => {
  const { changeName } = useAuth();
  const [first, setFirst] = useState(() => (user?.name ?? '').split(' ')[0] ?? '');
  const [last, setLast] = useState(() => (user?.name ?? '').split(' ').slice(1).join(' ') ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors text-sm";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!first.trim()) errs.first = 'Введите имя';
    if (!last.trim()) errs.last = 'Введите фамилию';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    const err = await changeName(`${first.trim()} ${last.trim()}`);
    setLoading(false);
    if (err) { setErrors({ general: err }); return; }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <input value={first} onChange={e => { setFirst(e.target.value); setErrors(p => ({ ...p, first: '' })); }}
            placeholder="Имя" className={cn(inputClass, errors.first && "border-red-500/60")} autoComplete="given-name" autoFocus />
          {errors.first && <p className="text-red-400 text-xs px-1">{errors.first}</p>}
        </div>
        <div className="space-y-1">
          <input value={last} onChange={e => { setLast(e.target.value); setErrors(p => ({ ...p, last: '' })); }}
            placeholder="Фамилия" className={cn(inputClass, errors.last && "border-red-500/60")} autoComplete="family-name" />
          {errors.last && <p className="text-red-400 text-xs px-1">{errors.last}</p>}
        </div>
      </div>
      {errors.general && <p className="text-red-400 text-xs text-center">{errors.general}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl font-medium text-sm transition-all">
          Отмена
        </button>
        <button type="submit" disabled={loading} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-all">
          {loading ? '...' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
};

// ── Main Profile component ────────────────────────────────────────────────────
export const Profile = () => {
  const { user, tier, logout, changePassword, changeName, resetPasswordViaTelegram, resetPasswordViaToken } = useAuth();
  const { colorMode, accentColor, setColorMode, setAccentColor } = useTheme();
  const navigate = useNavigate();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, permission: pushPermission, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications(user);
  const [pushLoading, setPushLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'main' | 'name' | 'password' | 'appearance'>('main');

  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);

  useEffect(() => { if (tier !== 'guest') loadDevices(); }, [tier]);

  const loadDevices = async () => {
    setDevicesLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/devices', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setDevices(data.devices || []); }
    } finally { setDevicesLoading(false); }
  };

  const removeDevice = async (deviceId: string) => {
    const token = localStorage.getItem('auth_token');
    await fetch(`/api/devices/${deviceId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDevices(prev => prev.filter(d => d.id !== deviceId));
  };

  const openSettings = (section: typeof settingsSection = 'main') => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };
  const closeSettings = () => { setSettingsOpen(false); setTimeout(() => setSettingsSection('main'), 300); };

  const currentDeviceId = localStorage.getItem('device_id');
  const ACCENTS: AccentColor[] = ['blue', 'orange', 'green', 'purple', 'rose'];

  if (tier === 'guest') {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-zinc-800 rounded-[28px] flex items-center justify-center text-zinc-600 mb-6">
          <UserIcon size={40} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Вы не авторизованы</h1>
        <p className="text-zinc-500 mb-8 max-w-xs text-sm">Войдите или зарегистрируйтесь, чтобы сохранять прогресс и управлять подпиской</p>
        <button onClick={() => navigate('/auth')}
          className="w-full max-w-xs py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20">
          Войти / Зарегистрироваться
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pb-24 md:pb-10 max-w-5xl mx-auto px-0 md:px-4">

      {/* ── Desktop two-column / Mobile single-column ──────────────────────── */}
      <div className="md:grid md:grid-cols-[340px_1fr] md:gap-6 md:items-start space-y-4 md:space-y-0">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Hero card */}
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-5">
            {/* Desktop: stacked; Mobile: row */}
            <div className="hidden md:flex md:flex-col md:items-center md:text-center md:gap-4 md:py-2">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-700 rounded-[24px] flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-orange-500/20">
                {user?.name?.[0] ?? '?'}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">{user?.name}</h1>
                <p className="text-zinc-500 text-sm mt-0.5">@{user?.username}</p>
                <span className={cn(
                  "inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                  tier === 'premium' ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"
                )}>
                  {TIER_LABELS[tier]}
                </span>
              </div>
              <button onClick={() => openSettings()}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-zinc-300 hover:text-white transition-all text-sm font-medium">
                <Settings size={15} /> Настройки
              </button>
            </div>
            {/* Mobile row layout */}
            <div className="flex items-center gap-4 md:hidden">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-700 rounded-[20px] flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-lg shadow-orange-500/20">
                {user?.name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-white leading-tight truncate">{user?.name}</h1>
                <p className="text-zinc-500 text-sm truncate">@{user?.username}</p>
                <span className={cn(
                  "inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                  tier === 'premium' ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"
                )}>
                  {TIER_LABELS[tier]}
                </span>
              </div>
              <button onClick={() => openSettings()}
                className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-white transition-all shrink-0">
                <Settings size={18} />
              </button>
            </div>
          </div>

          {/* Membership */}
          <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm">
              <Crown size={16} className="text-orange-500" /> Членство SCA
            </h3>
            {tier === 'premium' ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                  <span className="text-zinc-400 text-sm">Статус</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400">Premium активна</span>
                </div>
                {user?.subscription_expires_at && (() => {
                  const date = parseDbDate(user.subscription_expires_at);
                  if (!date) return null;
                  const diffMs = date.getTime() - Date.now();
                  const diffHours = Math.ceil(diffMs / 3600_000);
                  const diffDays = Math.floor(diffMs / 86400_000);
                  const dateStr = date.toLocaleString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
                  const remaining = diffMs <= 0 ? 'истекла' : diffHours <= 48 ? `${diffHours} ч.` : `${diffDays} дн.`;
                  const expired = diffMs <= 0;
                  return (
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl gap-3">
                      <span className="text-zinc-500 text-sm shrink-0">Активна до</span>
                      <span className="text-right min-w-0">
                        <span className="text-orange-400 font-semibold text-sm">{dateStr}</span>
                        <span className={cn("text-xs ml-1.5", expired ? "text-red-400" : "text-zinc-500")}>· {remaining}</span>
                      </span>
                    </div>
                  );
                })()}
                <a href="https://t.me/tribute/app?profile" target="_blank" rel="noopener noreferrer"
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl font-medium transition-all text-sm flex items-center justify-center">
                  Управление подпиской
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-2xl">
                  <span className="text-zinc-400 text-sm">Статус</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/20 text-green-400">Бесплатный</span>
                </div>
                <ul className="space-y-1.5 text-sm text-zinc-600 px-1">
                  <li className="flex items-center gap-2"><Lock size={12} className="text-zinc-700 shrink-0" /> Семинары и эфиры</li>
                  <li className="flex items-center gap-2"><Lock size={12} className="text-zinc-700 shrink-0" /> Материалы и мастер-классы</li>
                </ul>
                <a href="https://web.tribute.tg/s/kCa" target="_blank" rel="noopener noreferrer"
                  className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm">
                  <Crown size={15} /> Оформить Premium
                </a>
              </div>
            )}
          </div>

        </div>{/* end left column */}

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          <TelegramLinkCard />

          {/* Security card */}
          {/* Sessions (collapsible) */}
          <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden">
            <button
              onClick={() => setDevicesOpen(v => !v)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
            >
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <Monitor size={16} className="text-zinc-500" /> Активные сессии
                {devices.length > 0 && (
                  <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">{devices.length}</span>
                )}
              </span>
              <ChevronDown size={16} className={cn("text-zinc-600 transition-transform", devicesOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {devicesOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-4 pt-2 pb-4 space-y-2">
                    {devicesLoading ? (
                      <p className="text-zinc-600 text-sm text-center py-3">Загрузка...</p>
                    ) : devices.length === 0 ? (
                      <p className="text-zinc-600 text-sm text-center py-3">Нет активных сессий</p>
                    ) : devices.map(device => {
                      const isCurrent = device.id === currentDeviceId;
                      const d = parseDbDate(device.last_seen);
                      const lastSeenStr = d ? d.toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
                      return (
                        <div key={device.id} className={cn(
                          "flex items-center justify-between p-3 rounded-2xl",
                          isCurrent ? "bg-orange-500/10 border border-orange-500/20" : "bg-white/5"
                        )}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 shrink-0">
                              {/mobile|android|iphone|ipad/i.test(device.name) ? <Smartphone size={14} /> : <Laptop size={14} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium truncate">
                                {device.name}
                                {isCurrent && <span className="ml-1.5 text-xs text-orange-400 font-normal">текущее</span>}
                              </p>
                              <p className="text-zinc-600 text-xs">{lastSeenStr}</p>
                            </div>
                          </div>
                          {!isCurrent && (
                            <button onClick={() => removeDevice(device.id)}
                              className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors rounded-xl hover:bg-white/5 shrink-0">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <PaymentHistoryCard />

        </div>{/* end right column */}

      </div>{/* end grid */}

      {/* ── Settings BottomSheet ───────────────────────────────────────────── */}
      <BottomSheet
        isOpen={settingsOpen}
        onClose={closeSettings}
        title={
          settingsSection === 'name' ? 'Изменить имя' :
          settingsSection === 'password' ? 'Сменить пароль' :
          settingsSection === 'appearance' ? 'Оформление' :
          'Настройки'
        }
      >
        <AnimatePresence mode="wait">
          {settingsSection === 'main' && (
            <motion.div key="main" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-1">
              <SectionLabel>Аккаунт</SectionLabel>
              <SettingsRow icon={<Pencil size={16} />} label="Изменить имя" sublabel={user?.name} onClick={() => setSettingsSection('name')} />
              <SettingsRow icon={<KeyRound size={16} />} label="Сменить пароль" onClick={() => setSettingsSection('password')} />

              <SectionLabel>Внешний вид</SectionLabel>
              <SettingsRow
                icon={colorMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                label="Оформление"
                sublabel={`${colorMode === 'dark' ? 'Тёмная' : 'Светлая'} · ${ACCENT_LABELS[accentColor]}`}
                onClick={() => setSettingsSection('appearance')}
              />

              {pushSupported && (
                <>
                  <SectionLabel>Уведомления</SectionLabel>
                  <SettingsRow
                    icon={pushSubscribed ? <BellOff size={16} /> : <Bell size={16} />}
                    label={pushSubscribed ? 'Отключить push-уведомления' : 'Включить push-уведомления'}
                    sublabel={pushPermission === 'denied' ? 'Заблокировано в браузере' : undefined}
                    active={pushSubscribed}
                    onClick={async () => {
                      if (pushPermission === 'denied') return;
                      setPushLoading(true);
                      if (pushSubscribed) await pushUnsubscribe(); else await pushSubscribe();
                      setPushLoading(false);
                    }}
                    right={
                      <div className={cn("w-10 h-6 rounded-full transition-all flex items-center px-0.5 shrink-0", pushSubscribed ? "bg-green-500" : "bg-zinc-700")}>
                        <div className={cn("w-5 h-5 bg-white rounded-full transition-transform", pushSubscribed && "translate-x-4")} />
                      </div>
                    }
                  />
                </>
              )}

              <SectionLabel>Прочее</SectionLabel>
              <SettingsRow
                icon={<EyeOff size={16} />}
                label="Вернуть скрытые видео"
                onClick={() => {
                  localStorage.removeItem(HIDDEN_VIDEOS_KEY);
                  window.dispatchEvent(new CustomEvent('sca_history_update'));
                  closeSettings();
                }}
              />
              {!!user?.is_admin && (
                <SettingsRow icon={<Shield size={16} />} label="Панель администратора" onClick={() => { closeSettings(); navigate('/admin'); }} />
              )}

              <div className="pt-2">
                <SettingsRow icon={<LogOut size={16} />} label="Выйти из аккаунта" onClick={logout} danger right={null} />
              </div>
            </motion.div>
          )}

          {settingsSection === 'name' && (
            <motion.div key="name" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setSettingsSection('main')} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-5 transition-colors">
                <ArrowLeft size={14} /> Назад
              </button>
              <NameForm user={user} onSuccess={() => setSettingsSection('main')} onCancel={() => setSettingsSection('main')} />
            </motion.div>
          )}

          {settingsSection === 'password' && (
            <motion.div key="password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setSettingsSection('main')} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-5 transition-colors">
                <ArrowLeft size={14} /> Назад
              </button>
              <PasswordForm onSuccess={() => setSettingsSection('main')} onCancel={() => setSettingsSection('main')} />
            </motion.div>
          )}

          {settingsSection === 'appearance' && (
            <motion.div key="appearance" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <button onClick={() => setSettingsSection('main')} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors">
                <ArrowLeft size={14} /> Назад
              </button>
              <div>
                <p className="text-zinc-400 text-sm mb-3">Тема</p>
                <div className="flex gap-2">
                  {(['dark', 'light'] as ColorMode[]).map(mode => (
                    <button key={mode} onClick={() => setColorMode(mode)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border transition-all",
                        colorMode === mode ? "bg-orange-500 border-orange-500 text-white" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                      )}>
                      {mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                      {mode === 'dark' ? 'Тёмная' : 'Светлая'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-zinc-400 text-sm mb-3">Цвет акцента</p>
                <div className="flex gap-3">
                  {ACCENTS.map(color => (
                    <button key={color} onClick={() => setAccentColor(color)} title={ACCENT_LABELS[color]}
                      className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-all border-2", accentColor === color ? "border-white scale-110" : "border-transparent hover:scale-105")}
                      style={{ backgroundColor: ACCENT_HEX[color] }}>
                      {accentColor === color && <Check size={16} className="text-white" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
                <p className="text-zinc-600 text-xs mt-2">{ACCENT_LABELS[accentColor]}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </BottomSheet>
    </motion.div>
  );
};
