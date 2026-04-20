import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  User as UserIcon, LogOut, Crown, CheckCircle2, Lock, Settings,
  ChevronRight, EyeOff, Eye, Shield, KeyRound, Pencil, Monitor, Trash2,
  Laptop, Smartphone, Sun, Moon, Palette, Check, Bell, BellOff,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, AccentColor, ACCENT_LABELS, ACCENT_HEX, ColorMode } from '../contexts/ThemeContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { cn } from '../lib/utils';
import { TIER_LABELS, HIDDEN_VIDEOS_KEY } from '../constants';

interface Device {
  id: string;
  name: string;
  last_seen: string;
  created_at: string;
}

export const Profile = () => {
  const { user, tier, logout, upgradeToPremium, changePassword, changeName } = useAuth();
  const { colorMode, accentColor, setColorMode, setAccentColor } = useTheme();
  const navigate = useNavigate();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, permission: pushPermission, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications(user);
  const [pushLoading, setPushLoading] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<{ current?: string; new?: string; confirm?: string; general?: string }>({});
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Name change state
  const [showNameForm, setShowNameForm] = useState(false);
  const [nameFirst, setNameFirst] = useState(() => (user?.name ?? '').split(' ')[0] ?? '');
  const [nameLast, setNameLast] = useState(() => (user?.name ?? '').split(' ').slice(1).join(' ') ?? '');
  const [nameErrors, setNameErrors] = useState<{ first?: string; last?: string; general?: string }>({});
  const [nameLoading, setNameLoading] = useState(false);

  // Devices state
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  useEffect(() => {
    if (tier !== 'guest') loadDevices();
  }, [tier]);

  const loadDevices = async () => {
    setDevicesLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/devices', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } finally {
      setDevicesLoading(false);
    }
  };

  const removeDevice = async (deviceId: string) => {
    const token = localStorage.getItem('auth_token');
    await fetch(`/api/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setDevices(prev => prev.filter(d => d.id !== deviceId));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof pwdErrors = {};
    if (!currentPwd) errs.current = 'Введите текущий пароль';
    if (!newPwd) errs.new = 'Введите новый пароль';
    else if (newPwd.length < 8) errs.new = 'Минимум 8 символов';
    else if (!/[A-Z]/.test(newPwd)) errs.new = 'Нужна хотя бы одна заглавная буква';
    else if (!/[0-9]/.test(newPwd)) errs.new = 'Нужна хотя бы одна цифра';
    if (newPwd && confirmPwd && newPwd !== confirmPwd) errs.confirm = 'Пароли не совпадают';
    if (Object.keys(errs).length > 0) { setPwdErrors(errs); return; }
    setPwdErrors({});
    setPwdLoading(true);
    const err = await changePassword(currentPwd, newPwd);
    setPwdLoading(false);
    if (err) {
      // Map server error to the right field
      const m = err.toLowerCase();
      if (m.includes('текущий') || m.includes('неверный')) setPwdErrors({ current: err });
      else setPwdErrors({ general: err });
      return;
    }
    setPwdSuccess(true);
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    setTimeout(() => { setPwdSuccess(false); setShowPasswordForm(false); }, 2000);
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof nameErrors = {};
    if (!nameFirst.trim()) errs.first = 'Введите имя';
    if (!nameLast.trim()) errs.last = 'Введите фамилию';
    if (Object.keys(errs).length > 0) { setNameErrors(errs); return; }
    setNameErrors({});
    setNameLoading(true);
    const fullName = `${nameFirst.trim()} ${nameLast.trim()}`;
    const err = await changeName(fullName);
    setNameLoading(false);
    if (err) { setNameErrors({ general: err }); return; }
    setShowNameForm(false);
  };

  const currentDeviceId = localStorage.getItem('device_id');

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors text-sm";

  if (tier === 'guest') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-20 h-20 bg-zinc-800 rounded-[28px] flex items-center justify-center text-zinc-600 mb-6">
          <UserIcon size={40} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Вы не авторизованы</h1>
        <p className="text-zinc-500 mb-8 max-w-xs text-sm">
          Войдите или зарегистрируйтесь, чтобы сохранять прогресс и управлять подпиской
        </p>
        <button
          onClick={() => navigate('/auth')}
          className="w-full max-w-xs py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20"
        >
          Войти / Зарегистрироваться
        </button>
      </motion.div>
    );
  }

  const ACCENTS: AccentColor[] = ['blue', 'orange', 'green', 'purple', 'rose'];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 pb-24 md:pb-6"
    >
      <header className="flex flex-col items-center text-center pt-2">
        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-700 rounded-[28px] flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-xl shadow-orange-500/20">
          {user?.name?.[0] ?? '?'}
        </div>
        <h1 className="text-xl font-bold text-white">{user?.name}</h1>
        <p className="text-zinc-500 text-sm truncate max-w-xs">@{user?.username}</p>
        <span className={cn(
          "mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
          tier === 'premium' ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"
        )}>
          {TIER_LABELS[tier]}
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Membership */}
        <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2">
            <Crown size={18} className="text-orange-500" /> Членство SCA
          </h3>
          {tier === 'premium' ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                <span className="text-zinc-300 text-sm">Статус</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400">
                  Premium активна
                </span>
              </div>
              {user?.subscription_expires_at && (() => {
                const date = new Date(user.subscription_expires_at);
                const diffMs = date.getTime() - Date.now();
                const diffHours = Math.ceil(diffMs / 3600_000);
                const diffDays = Math.floor(diffMs / 86400_000);
                const dateStr = date.toLocaleString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const label = diffMs <= 0 ? 'Истекла' : diffHours <= 48 ? `Осталось ${diffHours} ч.` : `Осталось ${diffDays} дн.`;
                return (
                  <div className="flex justify-between items-start p-3 bg-white/5 rounded-2xl gap-2">
                    <span className="text-zinc-400 text-sm shrink-0">Активна до</span>
                    <div className="text-right">
                      <span className="text-orange-400 font-bold text-sm block">{dateStr}</span>
                      <span className="text-zinc-500 text-xs">{label}</span>
                    </div>
                  </div>
                );
              })()}
              <p className="text-zinc-500 text-xs text-center pt-1">Вы имеете полный доступ ко всем семинарам</p>
              <a
                href="https://t.me/tribute/app?profile"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl font-medium transition-all text-sm flex items-center justify-center"
              >
                Управление подпиской
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-2xl">
                <span className="text-zinc-400 text-sm">Статус</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/20 text-green-400">
                  Бесплатный
                </span>
              </div>
              <ul className="space-y-2 text-sm text-zinc-500 px-1">
                <li className="flex items-center gap-2"><Lock size={13} className="text-zinc-700 shrink-0" /> Материалы и эфиры</li>
                <li className="flex items-center gap-2"><Lock size={13} className="text-zinc-700 shrink-0" /> Материалы и мастер-классы</li>
              </ul>
              <a
                href="https://web.tribute.tg/s/kCa"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Crown size={16} /> Оформить Premium
              </a>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2">
            <Settings size={18} className="text-zinc-500" /> Настройки
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => setShowNameForm(v => !v)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-orange-500 transition-colors">
                  <Pencil size={16} />
                </div>
                <span className="text-zinc-400 group-hover:text-white text-sm">Изменить имя</span>
              </div>
              <ChevronRight size={16} className={cn("text-zinc-600 transition-transform", showNameForm && "rotate-90")} />
            </button>
            {showNameForm && (
              <form onSubmit={handleNameSubmit} className="px-3 pb-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <input
                      value={nameFirst}
                      onChange={e => { setNameFirst(e.target.value); setNameErrors(p => ({ ...p, first: undefined })); }}
                      placeholder="Имя"
                      className={cn(inputClass, nameErrors.first && "border-red-500/60")}
                      autoComplete="given-name"
                    />
                    {nameErrors.first && <p className="text-red-400 text-xs px-1">{nameErrors.first}</p>}
                  </div>
                  <div className="space-y-1">
                    <input
                      value={nameLast}
                      onChange={e => { setNameLast(e.target.value); setNameErrors(p => ({ ...p, last: undefined })); }}
                      placeholder="Фамилия"
                      className={cn(inputClass, nameErrors.last && "border-red-500/60")}
                      autoComplete="family-name"
                    />
                    {nameErrors.last && <p className="text-red-400 text-xs px-1">{nameErrors.last}</p>}
                  </div>
                </div>
                {nameErrors.general && <p className="text-red-400 text-xs">{nameErrors.general}</p>}
                <button
                  type="submit"
                  disabled={nameLoading}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all"
                >
                  {nameLoading ? '...' : 'Сохранить'}
                </button>
              </form>
            )}

            <button
              onClick={() => { setShowPasswordForm(v => !v); setPwdErrors({}); setPwdSuccess(false); }}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-orange-500 transition-colors">
                  <KeyRound size={16} />
                </div>
                <span className="text-zinc-400 group-hover:text-white text-sm">Сменить пароль</span>
              </div>
              <ChevronRight size={16} className={cn("text-zinc-600 transition-transform", showPasswordForm && "rotate-90")} />
            </button>
            {showPasswordForm && (
              <form onSubmit={handlePasswordSubmit} className="px-3 pb-2 space-y-2">
                <div className="space-y-1">
                  <div className="relative">
                    <input type={showCurrentPwd ? 'text' : 'password'} value={currentPwd} onChange={e => { setCurrentPwd(e.target.value); setPwdErrors(p => ({ ...p, current: undefined })); }} placeholder="Текущий пароль" className={cn(inputClass, pwdErrors.current && "border-red-500/60", "pr-10")} autoComplete="current-password" />
                    <button type="button" onClick={() => setShowCurrentPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors" tabIndex={-1}>{showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  {pwdErrors.current && <p className="text-red-400 text-xs px-1">{pwdErrors.current}</p>}
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <input type={showNewPwd ? 'text' : 'password'} value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdErrors(p => ({ ...p, new: undefined })); }} placeholder="Новый пароль" className={cn(inputClass, pwdErrors.new && "border-red-500/60", "pr-10")} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors" tabIndex={-1}>{showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  {pwdErrors.new && <p className="text-red-400 text-xs px-1">{pwdErrors.new}</p>}
                  {!pwdErrors.new && (
                    <ul className="text-xs space-y-0.5 px-1">
                      <li className={cn(newPwd.length >= 8 ? 'text-green-500' : 'text-zinc-600')}>• Минимум 8 символов</li>
                      <li className={cn(/[A-Z]/.test(newPwd) ? 'text-green-500' : 'text-zinc-600')}>• Хотя бы одна заглавная буква</li>
                      <li className={cn(/[0-9]/.test(newPwd) ? 'text-green-500' : 'text-zinc-600')}>• Хотя бы одна цифра</li>
                    </ul>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <input type={showConfirmPwd ? 'text' : 'password'} value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setPwdErrors(p => ({ ...p, confirm: undefined })); }} placeholder="Повторите новый пароль" className={cn(inputClass, pwdErrors.confirm && "border-red-500/60", "pr-10")} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowConfirmPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors" tabIndex={-1}>{showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  {pwdErrors.confirm && <p className="text-red-400 text-xs px-1">{pwdErrors.confirm}</p>}
                </div>
                {pwdErrors.general && <p className="text-red-400 text-xs">{pwdErrors.general}</p>}
                {pwdSuccess && <p className="text-green-400 text-xs">Пароль успешно изменён!</p>}
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all"
                >
                  {pwdLoading ? '...' : 'Изменить пароль'}
                </button>
              </form>
            )}

            {pushSupported && (
              <button
                onClick={async () => {
                  setPushLoading(true);
                  if (pushSubscribed) {
                    await pushUnsubscribe();
                  } else {
                    await pushSubscribe();
                  }
                  setPushLoading(false);
                }}
                disabled={pushLoading || pushPermission === 'denied'}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-orange-500 transition-colors">
                    {pushSubscribed ? <BellOff size={16} /> : <Bell size={16} />}
                  </div>
                  <div className="text-left">
                    <span className="text-zinc-400 group-hover:text-white text-sm block">
                      {pushSubscribed ? 'Отключить push-уведомления' : 'Включить push-уведомления'}
                    </span>
                    {pushPermission === 'denied' && (
                      <span className="text-red-400 text-xs">Уведомления заблокированы в настройках браузера</span>
                    )}
                  </div>
                </div>
                <div className={cn(
                  "w-10 h-6 rounded-full transition-all flex items-center px-0.5",
                  pushSubscribed ? "bg-green-500" : "bg-zinc-700"
                )}>
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full transition-transform",
                    pushSubscribed && "translate-x-4"
                  )} />
                </div>
              </button>
            )}

            <button
              onClick={() => {
                localStorage.removeItem(HIDDEN_VIDEOS_KEY);
                window.dispatchEvent(new CustomEvent('sca_history_update'));
                alert('Все скрытые видео возвращены в список.');
              }}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-orange-500 transition-colors">
                  <EyeOff size={16} />
                </div>
                <span className="text-zinc-400 group-hover:text-white text-sm">Вернуть скрытые видео</span>
              </div>
              <ChevronRight size={16} className="text-zinc-600" />
            </button>
            {!!user?.is_admin && (
              <button
                onClick={() => navigate('/admin')}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-orange-500 transition-colors">
                    <Shield size={16} />
                  </div>
                  <span className="text-zinc-400 group-hover:text-white text-sm">Панель администратора</span>
                </div>
                <ChevronRight size={16} className="text-zinc-600" />
              </button>
            )}
            <button
              onClick={logout}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors group text-red-400"
            >
              <span className="text-sm">Выйти из аккаунта</span>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
        <h3 className="text-white font-bold mb-5 flex items-center gap-2">
          <Palette size={18} className="text-zinc-500" /> Оформление
        </h3>
        <div className="space-y-5">
          {/* Color mode */}
          <div>
            <p className="text-zinc-400 text-sm mb-3">Тема</p>
            <div className="flex gap-2">
              {(['dark', 'light'] as ColorMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setColorMode(mode)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border transition-all",
                    colorMode === mode
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                  )}
                >
                  {mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                  {mode === 'dark' ? 'Тёмная' : 'Светлая'}
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div>
            <p className="text-zinc-400 text-sm mb-3">Цвет акцента</p>
            <div className="flex gap-2 flex-wrap">
              {ACCENTS.map(color => (
                <button
                  key={color}
                  onClick={() => setAccentColor(color)}
                  title={ACCENT_LABELS[color]}
                  className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-all border-2",
                    accentColor === color ? "border-white scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: ACCENT_HEX[color] }}
                >
                  {accentColor === color && <Check size={16} className="text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
            <p className="text-zinc-600 text-xs mt-2">{ACCENT_LABELS[accentColor]}</p>
          </div>
        </div>
      </div>

      {/* Devices */}
      <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
        <h3 className="text-white font-bold mb-1 flex items-center gap-2">
          <Monitor size={18} className="text-zinc-500" /> Активные устройства
        </h3>
        <p className="text-zinc-600 text-xs mb-5">Максимум 5 устройств на аккаунт</p>
        {devicesLoading ? (
          <div className="text-zinc-600 text-sm text-center py-4">Загрузка...</div>
        ) : devices.length === 0 ? (
          <div className="text-zinc-600 text-sm text-center py-4">Нет активных устройств</div>
        ) : (
          <div className="space-y-2">
            {devices.map(device => {
              const isCurrent = device.id === currentDeviceId;
              return (
                <div
                  key={device.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-2xl",
                    isCurrent ? "bg-orange-500/10 border border-orange-500/20" : "bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                      {/mobile|android|iphone|ipad/i.test(device.name) ? <Smartphone size={16} /> : <Laptop size={16} />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {device.name}
                        {isCurrent && <span className="ml-2 text-xs text-orange-400 font-normal">текущее</span>}
                      </p>
                      <p className="text-zinc-600 text-xs">
                        {new Date(device.last_seen).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => removeDevice(device.id)}
                      className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors rounded-xl hover:bg-white/5"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
