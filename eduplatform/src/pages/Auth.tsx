import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Send, ArrowLeft, CheckCircle2, ChevronDown } from 'lucide-react';
import { useAuth, TelegramUser } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { TelegramAuth } from '../components/TelegramAuth';

const TG_BLUE = '#229ED9';

const Input = ({
  type = 'text', placeholder, value, onChange, error, autoComplete, autoFocus, children,
}: {
  type?: string; placeholder: string; value: string;
  onChange: (v: string) => void; error?: string;
  autoComplete?: string; autoFocus?: boolean; children?: React.ReactNode;
}) => (
  <div className="space-y-1">
    <div className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={cn(
          "w-full bg-white/5 border rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors",
          children ? "pr-12" : "",
          error ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-orange-500",
        )}
      />
      {children}
    </div>
    {error && <p className="text-red-400 text-xs px-1">{error}</p>}
  </div>
);

// ─── Password field with show/hide ───────────────────────────────────────────

const PwdInput = ({ placeholder, value, onChange, error, autoComplete, autoFocus }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  error?: string; autoComplete?: string; autoFocus?: boolean;
}) => {
  const [show, setShow] = useState(false);
  return (
    <Input type={show ? 'text' : 'password'} placeholder={placeholder} value={value}
      onChange={onChange} error={error} autoComplete={autoComplete} autoFocus={autoFocus}>
      <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </Input>
  );
};

// ─── Password strength hints ──────────────────────────────────────────────────

const PwdHints = ({ pwd }: { pwd: string }) => (
  <ul className="text-xs space-y-0.5 px-1 pt-0.5">
    <li className={cn(pwd.length >= 8 ? 'text-green-500' : 'text-zinc-600')}>• Минимум 8 символов</li>
    <li className={cn(/[A-Z]/.test(pwd) ? 'text-green-500' : 'text-zinc-600')}>• Хотя бы одна заглавная буква</li>
    <li className={cn(/[0-9]/.test(pwd) ? 'text-green-500' : 'text-zinc-600')}>• Хотя бы одна цифра</li>
  </ul>
);

// ─── Main component ───────────────────────────────────────────────────────────

type Step = 'login' | 'register' | 'link-telegram';

export const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, register, telegramSignin, linkTelegram, refreshUser, user, isLoading } = useAuth();

  // Redirect already-logged-in users to home
  useEffect(() => {
    if (!isLoading && user) navigate('/', { replace: true });
  }, [user, isLoading, navigate]);

  const [step, setStep] = useState<Step>(
    searchParams.get('tab') === 'register' ? 'register' : 'login'
  );
  const [showTelegramLogin, setShowTelegramLogin] = useState(false);

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regLoading, setRegLoading] = useState(false);

  // Telegram link step (after register)
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkDone, setLinkDone] = useState(false);

  // ── Login by password ──────────────────────────────────────────────────────

  const handleLoginPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      setLoginError('Заполните все поля');
      return;
    }
    setLoginError('');
    setLoginLoading(true);
    const err = await login(loginUsername.trim(), loginPassword);
    setLoginLoading(false);
    if (err) { setLoginError(err); return; }
    navigate('/');
  };

  // ── Login by Telegram ──────────────────────────────────────────────────────

  const handleLoginTelegram = async (tgUser?: TelegramUser) => {
    if (!tgUser) return; // bot-code signin handles redirect itself
    setLoginError('');
    setLoginLoading(true);
    const err = await telegramSignin(tgUser);
    setLoginLoading(false);
    if (err) { setLoginError(err); return; }
    navigate('/');
  };

  // ── Register ───────────────────────────────────────────────────────────────

  const validateRegister = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Введите имя';
    if (!lastName.trim()) e.lastName = 'Введите фамилию';
    if (!email.trim()) e.email = 'Введите email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Некорректный email';
    if (!username.trim()) e.username = 'Введите логин';
    else if (username.length < 3) e.username = 'Минимум 3 символа';
    else if (!/^[a-zA-Z0-9_.-]+$/.test(username)) e.username = 'Только латиница, цифры, _ . -';
    if (!password) e.password = 'Введите пароль';
    else if (password.length < 8) e.password = 'Минимум 8 символов';
    else if (!/[A-Z]/.test(password)) e.password = 'Нужна заглавная буква';
    else if (!/[0-9]/.test(password)) e.password = 'Нужна цифра';
    return e;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateRegister();
    if (Object.keys(errs).length > 0) { setRegErrors(errs); return; }
    setRegErrors({});
    setRegLoading(true);
    const err = await register(
      username.trim(),
      password,
      `${firstName.trim()} ${lastName.trim()}`,
      { email: email.trim(), first_name: firstName.trim(), last_name: lastName.trim() },
    );
    setRegLoading(false);
    if (err) {
      const m = err.toLowerCase();
      if (m.includes('username') || m.includes('логин') || m.includes('already')) setRegErrors({ username: err });
      else if (m.includes('email') || m.includes('почт')) setRegErrors({ email: err });
      else setRegErrors({ general: err });
      return;
    }
    // Registration done → link Telegram step
    setStep('link-telegram');
  };

  // ── Link Telegram after register ───────────────────────────────────────────

  const handleLinkTelegram = async (tgUser?: TelegramUser) => {
    // tgUser is undefined when bot-code link completed server-side
    if (!tgUser) {
      setLinkDone(true);
      await refreshUser();
      setTimeout(() => navigate('/'), 1200);
      return;
    }
    setLinkError('');
    setLinkLoading(true);
    const err = await linkTelegram(tgUser);
    setLinkLoading(false);
    if (err) { setLinkError(err); return; }
    setLinkDone(true);
    await refreshUser();
    setTimeout(() => navigate('/'), 1200);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const card = "w-full max-w-md bg-zinc-900 border border-white/5 p-6 sm:p-8 rounded-[28px] sm:rounded-[40px] shadow-2xl";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen flex flex-col items-center justify-start py-8 px-2 sm:px-6 pb-28"
    >
      <div className={card}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black italic text-white mb-2 tracking-tighter">SCA</h1>
          <p className="text-zinc-500 text-sm">Swimming Coaches Association</p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP: Login ─────────────────────────────────────────────────── */}
          {step === 'login' && (
            <motion.div key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

              {/* Primary: password login */}
              <form onSubmit={handleLoginPassword} className="space-y-3">
                <Input placeholder="Логин" value={loginUsername} onChange={v => { setLoginUsername(v); setLoginError(''); }}
                  autoComplete="username" autoFocus />
                <PwdInput placeholder="Пароль" value={loginPassword} onChange={v => { setLoginPassword(v); setLoginError(''); }}
                  autoComplete="current-password" />
                {loginError && <p className="text-red-400 text-sm text-center">{loginError}</p>}
                <button type="submit" disabled={loginLoading}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20">
                  {loginLoading ? '...' : 'Войти'}
                </button>
              </form>

              {/* Secondary: Telegram login — collapsible, for existing users with linked TG */}
              <div className="mt-4">
                <button
                  onClick={() => { setShowTelegramLogin(v => !v); setLoginError(''); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all text-sm"
                >
                  <span className="flex items-center gap-2 font-medium" style={{ color: TG_BLUE }}>
                    <Send size={15} /> Войти через Telegram
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn("text-zinc-500 transition-transform duration-200", showTelegramLogin && "rotate-180")}
                  />
                </button>

                <AnimatePresence>
                  {showTelegramLogin && (
                    <motion.div
                      key="tg-panel"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 space-y-3">
                        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-3 py-3 flex flex-col gap-2">
                          <p className="text-amber-300/80 text-xs leading-relaxed">
                            <span className="font-bold">Только для существующих аккаунтов</span> с привязанным Telegram.
                            Ещё не регистрировались?
                          </p>
                          <button
                            onClick={() => { setStep('register'); setLoginError(''); setShowTelegramLogin(false); }}
                            className="self-start px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
                          >
                            Создать аккаунт →
                          </button>
                        </div>
                        {loginLoading
                          ? <p className="text-zinc-400 text-sm text-center py-3">Вход…</p>
                          : <TelegramAuth onAuth={handleLoginTelegram} mode="signin" />}
                        {loginError && (
                          <p className="text-red-400 text-sm text-center">
                            {loginError.toLowerCase().includes('not linked') || loginError.toLowerCase().includes('не найден')
                              ? 'Этот Telegram не привязан ни к одному аккаунту'
                              : loginError}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <p className="text-zinc-600 text-sm text-center mt-5">
                Нет аккаунта?{' '}
                <button onClick={() => { setStep('register'); setLoginError(''); }}
                  className="text-orange-400 hover:text-orange-300 font-bold transition-colors">
                  Зарегистрироваться
                </button>
              </p>
            </motion.div>
          )}

          {/* ── STEP: Register ──────────────────────────────────────────────── */}
          {step === 'register' && (
            <motion.div key="register" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <button onClick={() => setStep('login')}
                className="flex items-center gap-1 text-zinc-500 hover:text-white text-sm mb-5 transition-colors">
                <ArrowLeft size={15} /> Назад
              </button>

              <form onSubmit={handleRegister} className="space-y-3">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Имя" value={firstName} onChange={v => { setFirstName(v); setRegErrors(p => ({ ...p, firstName: '' })); }}
                    error={regErrors.firstName} autoComplete="given-name" autoFocus />
                  <Input placeholder="Фамилия" value={lastName} onChange={v => { setLastName(v); setRegErrors(p => ({ ...p, lastName: '' })); }}
                    error={regErrors.lastName} autoComplete="family-name" />
                </div>

                <Input type="email" placeholder="Email" value={email}
                  onChange={v => { setEmail(v); setRegErrors(p => ({ ...p, email: '' })); }}
                  error={regErrors.email} autoComplete="email" />

                <Input placeholder="Логин (a-z, 0-9, _ . -)" value={username}
                  onChange={v => { setUsername(v); setRegErrors(p => ({ ...p, username: '' })); }}
                  error={regErrors.username} autoComplete="username" />

                <div className="space-y-1">
                  <PwdInput placeholder="Пароль" value={password}
                    onChange={v => { setPassword(v); setRegErrors(p => ({ ...p, password: '' })); }}
                    error={regErrors.password} autoComplete="new-password" />
                  <PwdHints pwd={password} />
                </div>

                {regErrors.general && <p className="text-red-400 text-sm text-center">{regErrors.general}</p>}

                <button type="submit" disabled={regLoading}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 mt-1">
                  {regLoading ? '...' : 'Создать аккаунт'}
                </button>
              </form>

              <p className="text-zinc-600 text-sm text-center mt-6">
                Уже есть аккаунт?{' '}
                <button onClick={() => setStep('login')}
                  className="text-orange-400 hover:text-orange-300 font-bold transition-colors">
                  Войти
                </button>
              </p>
            </motion.div>
          )}

          {/* ── STEP: Link Telegram ─────────────────────────────────────────── */}
          {step === 'link-telegram' && (
            <motion.div key="link-tg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-5">
              {linkDone ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle2 size={48} className="text-green-400" />
                  <p className="text-white font-bold text-lg">Telegram привязан!</p>
                  <p className="text-zinc-500 text-sm text-center">Подписка активирована. Переходим…</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
                      style={{ backgroundColor: `${TG_BLUE}22` }}>
                      <Send size={28} style={{ color: TG_BLUE }} />
                    </div>
                    <h2 className="text-white font-bold text-xl">Привяжите Telegram</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      Чтобы активировать доступ по подписке Tribute — подключите Telegram.
                      Это нужно сделать один раз.
                    </p>
                  </div>

                  {linkLoading
                    ? <p className="text-zinc-400 text-sm text-center py-2">Обработка…</p>
                    : <TelegramAuth onAuth={handleLinkTelegram} mode="link" />}

                  {linkError && <p className="text-red-400 text-sm text-center">{linkError}</p>}

                  <button onClick={() => navigate('/')}
                    className="w-full py-3 text-zinc-500 hover:text-white text-sm transition-colors">
                    Пропустить, привяжу позже в профиле
                  </button>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
};
