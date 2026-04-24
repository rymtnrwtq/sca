import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Send, RefreshCw, CheckCircle2, Loader2, Copy, Check } from 'lucide-react';
import { TelegramUser } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

declare global {
  interface Window { onTelegramAuth?: (user: TelegramUser) => void; }
}

const TG_BLUE = '#229ED9';
const BOT_USERNAME = 'Swimming_Coaches_Association_bot';

// ── Standard Telegram widget ──────────────────────────────────────────────────

const TelegramWidget = ({ onAuth }: { onAuth: (u: TelegramUser) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    window.onTelegramAuth = onAuth;
    const c = ref.current;
    if (!c) return;
    c.innerHTML = '';

    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?23';
    s.async = true;
    s.setAttribute('data-telegram-login', BOT_USERNAME);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    s.setAttribute('data-request-access', 'write');
    s.setAttribute('data-userpic', 'false');
    s.setAttribute('data-lang', 'ru');
    s.onload = () => setLoaded(true);
    s.onerror = () => setTimedOut(true);
    c.appendChild(s);

    // If widget didn't load in 5s — show fallback hint
    const t = setTimeout(() => { if (!loaded) setTimedOut(true); }, 5000);
    return () => { clearTimeout(t); delete window.onTelegramAuth; };
  }, [onAuth]);

  return { ref, loaded, timedOut };
};

// ── Bot code waiting panel ────────────────────────────────────────────────────

const BotCodeWaiting = ({ code, status, botUsername }: { code: string; status: string; botUsername: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 text-center">
      <p className="text-zinc-400 text-xs">Отправьте этот код боту в Telegram:</p>

      {/* Code block with copy button */}
      <div
        className="relative rounded-xl px-4 py-3 flex items-center justify-center gap-3"
        style={{ backgroundColor: `${TG_BLUE}22`, border: `1px solid ${TG_BLUE}44` }}
      >
        <span className="text-white font-mono text-xl font-bold tracking-widest select-all">{code}</span>
        <button
          onClick={copy}
          title="Скопировать код"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: copied ? '#4ade80' : TG_BLUE }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>

      {copied && <p className="text-green-400 text-xs">Скопировано!</p>}

      <a
        href={`https://t.me/${botUsername}?start=${code}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-opacity hover:opacity-85 active:scale-[0.98]"
        style={{ backgroundColor: TG_BLUE, color: '#fff' }}
      >
        <Send size={15} /> Открыть бота и отправить код
      </a>

      {status === 'done' ? (
        <p className="text-green-400 text-xs flex items-center justify-center gap-1">
          <CheckCircle2 size={14} /> Подтверждено, входим…
        </p>
      ) : (
        <p className="text-zinc-600 text-xs flex items-center justify-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Ожидаем подтверждения…
        </p>
      )}
    </div>
  );
};

// ── Bot-code fallback ─────────────────────────────────────────────────────────

type BotStatus = 'idle' | 'waiting' | 'done' | 'expired' | 'error';

const BotCodePanel = ({
  onAuth,
  mode,
  authToken,
}: {
  onAuth: () => void;
  mode: 'signin' | 'link';
  authToken?: string;
}) => {
  const [status, setStatus] = useState<BotStatus>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => { if (pollRef.current) clearTimeout(pollRef.current); };

  const complete = useCallback(async (c: string) => {
    stopPolling();
    const endpoint = mode === 'signin' ? '/api/auth/bot-code/signin' : '/api/auth/bot-code/link';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ code: c }) });
    const data = await r.json();
    if (!data.success) { setError(data.message || 'Ошибка'); setStatus('error'); return; }
    if (mode === 'signin') {
      localStorage.setItem('auth_token', data.token);
      window.location.reload();
    } else {
      onAuth();
    }
  }, [mode, authToken, onAuth]);

  const poll = useCallback((c: string) => {
    pollRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/bot-code/status?code=${c}`);
        const data = await r.json();
        if (data.status === 'done') { setStatus('done'); await complete(c); }
        else if (data.status === 'expired') { setStatus('expired'); }
        else { poll(c); }
      } catch { poll(c); }
    }, 2000);
  }, [complete]);

  const start = async () => {
    setError('');
    setStatus('waiting');
    try {
      const r = await fetch('/api/auth/bot-code/start', { method: 'POST' });
      const data = await r.json();
      setCode(data.code);
      poll(data.code);
    } catch {
      setStatus('error');
      setError('Не удалось получить код. Попробуйте снова.');
    }
  };

  useEffect(() => () => stopPolling(), []);

  if (status === 'idle') {
    return (
      <button
        onClick={start}
        className="w-full py-2.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-zinc-400 hover:text-white text-xs text-center transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Send size={13} style={{ color: TG_BLUE }} />
        Кнопка не загружается? Войти через код из бота
      </button>
    );
  }

  if (status === 'waiting' || status === 'done') {
    return <BotCodeWaiting code={code} status={status} botUsername={BOT_USERNAME} />;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 text-center">
      <p className="text-red-400 text-xs">{error || 'Код истёк'}</p>
      <button
        onClick={start}
        className="text-zinc-400 hover:text-white text-xs flex items-center gap-1 mx-auto transition-colors"
      >
        <RefreshCw size={12} /> Получить новый код
      </button>
    </div>
  );
};

// ── Combined component ────────────────────────────────────────────────────────

export const TelegramAuth = ({
  onAuth,
  mode = 'signin',
  authToken,
}: {
  onAuth: (u?: TelegramUser) => void;
  mode?: 'signin' | 'link';
  authToken?: string;
}) => {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [widgetTimedOut, setWidgetTimedOut] = useState(false);

  useEffect(() => {
    window.onTelegramAuth = onAuth as (u: TelegramUser) => void;
    const c = widgetRef.current;
    if (!c) return;
    c.innerHTML = '';

    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?23';
    s.async = true;
    s.setAttribute('data-telegram-login', BOT_USERNAME);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    s.setAttribute('data-request-access', 'write');
    s.setAttribute('data-userpic', 'false');
    s.setAttribute('data-lang', 'ru');
    s.onerror = () => setWidgetTimedOut(true);
    c.appendChild(s);

    const t = setTimeout(() => {
      if (!c.querySelector('iframe')) setWidgetTimedOut(true);
    }, 5000);

    return () => { clearTimeout(t); delete window.onTelegramAuth; };
  }, [onAuth]);

  return (
    <div className="space-y-3">
      <div
        ref={widgetRef}
        className={cn(
          "flex justify-center [&>iframe]:rounded-2xl transition-opacity",
          widgetTimedOut && "opacity-30 pointer-events-none",
        )}
      />
      {widgetTimedOut && (
        <p className="text-zinc-600 text-xs text-center">
          Кнопка Telegram не загрузилась (возможно, заблокировано в вашей стране)
        </p>
      )}
      <BotCodePanel
        onAuth={() => onAuth(undefined)}
        mode={mode}
        authToken={authToken}
      />
    </div>
  );
};
