import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth, TelegramUser } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  password?: string;
  general?: string;
}

const Field = ({ error, children }: { error?: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    {children}
    {error && <p className="text-red-400 text-xs px-1">{error}</p>}
  </div>
);

const TG_BLUE = '#229ED9';

export const Auth = () => {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'login' | 'register'>(
    searchParams.get('tab') === 'register' ? 'register' : 'login'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTgPassword, setShowTgPassword] = useState(false);

  // Telegram state
  const [tgData, setTgData] = useState<TelegramUser | null>(null);
  const [tgMode, setTgMode] = useState<'login' | 'register'>('login');
  const [tgPassword, setTgPassword] = useState('');
  const [tgUsername, setTgUsername] = useState('');
  const [tgName, setTgName] = useState('');
  const [tgLinkUsername, setTgLinkUsername] = useState(''); // for linking existing account
  const [tgError, setTgError] = useState('');
  const [tgLoading, setTgLoading] = useState(false);

  const navigate = useNavigate();
  const { login, register, telegramLogin, telegramRegister } = useAuth();
  const tgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.onTelegramAuth = (user: TelegramUser) => {
      setTgData(user);
      setTgMode('login');
      setTgPassword('');
      setTgUsername(user.username || '');
      setTgName([user.first_name, user.last_name].filter(Boolean).join(' '));
      setTgLinkUsername('');
      setTgError('');
    };

    const container = tgContainerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?23';
    script.async = true;
    script.setAttribute('data-telegram-login', 'kmevermveokBot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-lang', 'ru');
    container.appendChild(script);

    return () => { delete window.onTelegramAuth; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearError = (field: keyof FieldErrors) =>
    setErrors(prev => ({ ...prev, [field]: undefined }));

  const validateRegister = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!firstName.trim()) e.firstName = 'Введите имя';
    if (!lastName.trim()) e.lastName = 'Введите фамилию';
    if (!email.trim()) e.email = 'Введите email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Некорректный email';
    if (!username.trim()) e.username = 'Введите логин';
    else if (username.length < 3) e.username = 'Минимум 3 символа';
    else if (!/^[a-zA-Z0-9_.-]+$/.test(username)) e.username = 'Только латинские буквы, цифры, _ . -';
    if (!password) e.password = 'Введите пароль';
    else if (password.length < 8) e.password = 'Минимум 8 символов';
    else if (!/[A-Z]/.test(password)) e.password = 'Нужна хотя бы одна заглавная буква';
    else if (!/[0-9]/.test(password)) e.password = 'Нужна хотя бы одна цифра';
    return e;
  };

  const validateLogin = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!username.trim()) e.username = 'Введите логин';
    if (!password) e.password = 'Введите пароль';
    return e;
  };

  const mapServerError = (msg: string): FieldErrors => {
    const m = msg.toLowerCase();
    if (m.includes('логин') || m.includes('username') || m.includes('уже занят') || m.includes('already exists') || (m.includes('символа') && !m.includes('пароль'))) {
      return { username: msg };
    }
    if (m.includes('пароль') || m.includes('password') || m.includes('символов') || m.includes('заглавн') || m.includes('цифр')) {
      return { password: msg };
    }
    if (m.includes('имя') || m.includes('фамили')) {
      return { firstName: msg };
    }
    if (m.includes('email') || m.includes('почт') || m.includes('e-mail')) {
      return { email: msg };
    }
    return { general: msg };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientErrors = tab === 'login' ? validateLogin() : validateRegister();
    if (Object.keys(clientErrors).length > 0) { setErrors(clientErrors); return; }
    setErrors({});
    setLoading(true);

    let serverErr: string | null = null;
    if (tab === 'login') {
      serverErr = await login(username, password);
    } else {
      serverErr = await register(
        username,
        password,
        `${firstName.trim()} ${lastName.trim()}`,
        { email: email.trim(), first_name: firstName.trim(), last_name: lastName.trim() },
      );
    }
    setLoading(false);
    if (serverErr) { setErrors(mapServerError(serverErr)); return; }
    navigate('/');
  };

  const handleTgLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgData) return;
    if (!tgPassword) { setTgError('Введите пароль'); return; }
    setTgError('');
    setTgLoading(true);
    const err = await telegramLogin(tgData, tgPassword, tgLinkUsername || undefined);
    setTgLoading(false);
    if (err) { setTgError(err); return; }
    navigate('/');
  };

  const handleTgRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgData) return;
    if (!tgUsername.trim()) { setTgError('Введите логин'); return; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(tgUsername)) { setTgError('Логин: только латинские буквы, цифры, _ . -'); return; }
    if (!tgPassword) { setTgError('Введите пароль'); return; }
    if (tgPassword.length < 8) { setTgError('Пароль минимум 8 символов'); return; }
    if (!/[A-Z]/.test(tgPassword)) { setTgError('Нужна хотя бы одна заглавная буква'); return; }
    if (!/[0-9]/.test(tgPassword)) { setTgError('Нужна хотя бы одна цифра'); return; }
    setTgError('');
    setTgLoading(true);
    const err = await telegramRegister(tgData, tgPassword, tgUsername, tgName || undefined);
    setTgLoading(false);
    if (err) { setTgError(err); return; }
    navigate('/');
  };

  const inputBase = "w-full bg-white/5 border rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:outline-none transition-colors";
  const inputOk = "border-white/10 focus:border-orange-500";
  const inputErr = "border-red-500/60 focus:border-red-500";

  const pwdMet = {
    len: password.length >= 8,
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
  };

  const tgDisplayName = tgData
    ? [tgData.first_name, tgData.last_name].filter(Boolean).join(' ')
    : '';

  const tgPwdMet = {
    len: tgPassword.length >= 8,
    upper: /[A-Z]/.test(tgPassword),
    digit: /[0-9]/.test(tgPassword),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-[80vh] flex flex-col items-center justify-center py-8 px-2 sm:px-6"
    >
      <div className="w-full max-w-md bg-zinc-900 border border-white/5 p-6 sm:p-8 rounded-[28px] sm:rounded-[40px] shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black italic text-white mb-2 tracking-tighter">SCA</h1>
          <p className="text-zinc-500">Swimming Coaches Association</p>
        </div>

        <AnimatePresence mode="wait">
          {tgData ? (
            /* ── Telegram step 2 ── */
            <motion.div
              key="tg-step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* TG user card */}
              <div className="flex items-center gap-3 mb-5 p-4 bg-white/5 border border-white/8 rounded-2xl">
                {tgData.photo_url
                  ? <img src={tgData.photo_url} alt="Фото профиля" className="w-10 h-10 rounded-full shrink-0" />
                  : <div className="w-10 h-10 rounded-full bg-[#229ED9]/20 flex items-center justify-center shrink-0 text-[#229ED9] font-bold text-sm">
                      {tgData.first_name?.[0] ?? 'T'}
                    </div>
                }
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold text-sm truncate">{tgDisplayName}</p>
                  {tgData.username && <p className="text-zinc-500 text-xs">@{tgData.username}</p>}
                </div>
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 fill-current" style={{ color: TG_BLUE }}>
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.01 9.471c-.149.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.873.75z" />
                </svg>
              </div>

              {/* Mode tabs */}
              <div className="flex bg-white/5 rounded-2xl p-1 mb-5">
                {(['login', 'register'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setTgMode(m); setTgError(''); }}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                      tgMode === m ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    {m === 'login' ? 'Войти' : 'Зарегистрироваться'}
                  </button>
                ))}
              </div>

              {tgMode === 'login' ? (
                <form onSubmit={handleTgLogin} className="space-y-3">
                  <p className="text-zinc-500 text-xs text-center">
                    Введите пароль от вашего аккаунта SCA
                  </p>
                  <div className="relative">
                    <input
                      type={showTgPassword ? 'text' : 'password'}
                      placeholder="Пароль"
                      value={tgPassword}
                      onChange={e => { setTgPassword(e.target.value); setTgError(''); }}
                      className={cn(inputBase, tgError ? inputErr : inputOk, 'pr-12')}
                      autoFocus
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTgPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showTgPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Логин (если Telegram ещё не привязан)"
                    value={tgLinkUsername}
                    onChange={e => setTgLinkUsername(e.target.value)}
                    className={cn(inputBase, inputOk)}
                    autoComplete="username"
                  />
                  {tgError && <p className="text-red-400 text-sm text-center">{tgError}</p>}
                  <button
                    type="submit"
                    disabled={tgLoading}
                    className="w-full py-4 text-white rounded-2xl font-bold text-lg transition-all disabled:opacity-50"
                    style={{ backgroundColor: TG_BLUE }}
                  >
                    {tgLoading ? '...' : 'Войти'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleTgRegister} className="space-y-3">
                  <p className="text-zinc-500 text-xs text-center">
                    Создайте новый аккаунт SCA
                  </p>
                  <input
                    type="text"
                    placeholder="Имя (из Telegram)"
                    value={tgName}
                    onChange={e => { setTgName(e.target.value); setTgError(''); }}
                    className={cn(inputBase, inputOk)}
                    autoComplete="name"
                  />
                  <input
                    type="text"
                    placeholder="Логин"
                    value={tgUsername}
                    onChange={e => { setTgUsername(e.target.value); setTgError(''); }}
                    className={cn(inputBase, tgError && tgError.toLowerCase().includes('логин') ? inputErr : inputOk)}
                    autoFocus
                    autoComplete="username"
                  />
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type={showTgPassword ? 'text' : 'password'}
                        placeholder="Пароль"
                        value={tgPassword}
                        onChange={e => { setTgPassword(e.target.value); setTgError(''); }}
                        className={cn(inputBase, tgError && tgError.toLowerCase().includes('пароль') ? inputErr : inputOk, 'pr-12')}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTgPassword(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showTgPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <ul className="text-xs space-y-0.5 px-1 pt-0.5">
                      <li className={cn(tgPwdMet.len ? 'text-green-500' : 'text-zinc-600')}>• Минимум 8 символов</li>
                      <li className={cn(tgPwdMet.upper ? 'text-green-500' : 'text-zinc-600')}>• Хотя бы одна заглавная буква</li>
                      <li className={cn(tgPwdMet.digit ? 'text-green-500' : 'text-zinc-600')}>• Хотя бы одна цифра</li>
                    </ul>
                  </div>
                  {tgError && <p className="text-red-400 text-sm text-center">{tgError}</p>}
                  <button
                    type="submit"
                    disabled={tgLoading}
                    className="w-full py-4 text-white rounded-2xl font-bold text-lg transition-all disabled:opacity-50"
                    style={{ backgroundColor: TG_BLUE }}
                  >
                    {tgLoading ? '...' : 'Создать аккаунт'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => setTgData(null)}
                className="w-full py-3 mt-2 text-zinc-500 hover:text-white text-sm transition-colors"
              >
                Отмена
              </button>
            </motion.div>
          ) : (
            /* ── Normal login / register ── */
            <motion.div
              key="normal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex bg-white/5 rounded-2xl p-1 mb-8">
                {(['login', 'register'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setErrors({}); }}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                      tab === t ? "bg-orange-500 text-white shadow" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    {t === 'login' ? 'Войти' : 'Регистрация'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {tab === 'register' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field error={errors.firstName}>
                        <input
                          type="text"
                          placeholder="Имя"
                          value={firstName}
                          onChange={e => { setFirstName(e.target.value); clearError('firstName'); }}
                          className={cn(inputBase, errors.firstName ? inputErr : inputOk)}
                          autoComplete="given-name"
                        />
                      </Field>
                      <Field error={errors.lastName}>
                        <input
                          type="text"
                          placeholder="Фамилия"
                          value={lastName}
                          onChange={e => { setLastName(e.target.value); clearError('lastName'); }}
                          className={cn(inputBase, errors.lastName ? inputErr : inputOk)}
                          autoComplete="family-name"
                        />
                      </Field>
                    </div>
                    <Field error={errors.email}>
                      <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); clearError('email'); }}
                        className={cn(inputBase, errors.email ? inputErr : inputOk)}
                        autoComplete="email"
                      />
                    </Field>
                  </>
                )}

                <Field error={errors.username}>
                  <input
                    type="text"
                    placeholder="Логин"
                    value={username}
                    onChange={e => { setUsername(e.target.value); clearError('username'); }}
                    className={cn(inputBase, errors.username ? inputErr : inputOk)}
                    autoComplete="username"
                  />
                </Field>

                <Field error={errors.password}>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Пароль"
                      value={password}
                      onChange={e => { setPassword(e.target.value); clearError('password'); }}
                      className={cn(inputBase, errors.password ? inputErr : inputOk, 'pr-12')}
                      autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {tab === 'register' && (
                    <ul className="text-xs space-y-0.5 px-1 pt-0.5">
                      <li className={cn(pwdMet.len ? 'text-green-500' : 'text-zinc-600')}>• Минимум 8 символов</li>
                      <li className={cn(pwdMet.upper ? 'text-green-500' : 'text-zinc-600')}>• Хотя бы одна заглавная буква</li>
                      <li className={cn(pwdMet.digit ? 'text-green-500' : 'text-zinc-600')}>• Хотя бы одна цифра</li>
                    </ul>
                  )}
                </Field>

                {errors.general && <p className="text-red-400 text-sm text-center">{errors.general}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 mt-1"
                >
                  {loading ? '...' : tab === 'login' ? 'Войти' : 'Создать аккаунт'}
                </button>
              </form>

              <div className="mt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-zinc-600 text-xs">или через Telegram</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <div ref={tgContainerRef} className="flex justify-center [&>iframe]:rounded-2xl" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
