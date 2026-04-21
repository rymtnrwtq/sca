import React, { useEffect, useRef, useState } from 'react';
import { Send, Link2, Unlink } from 'lucide-react';
import { useAuth, TelegramUser } from '../contexts/AuthContext';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export const TelegramLinkCard = () => {
  const { user, linkTelegram, unlinkTelegram, refreshUser } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const linked = !!user?.telegram_id;

  useEffect(() => {
    if (linked) return; // Don't render widget if already linked
    window.onTelegramAuth = async (tgUser: TelegramUser) => {
      setError(null); setSuccess(null); setBusy(true);
      const err = await linkTelegram(tgUser);
      setBusy(false);
      if (err) setError(err);
      else { setSuccess('Telegram привязан. Доступ к платному контенту обновлён.'); await refreshUser(); }
    };

    const c = containerRef.current;
    if (!c) return;
    c.innerHTML = '';
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?23';
    s.async = true;
    s.setAttribute('data-telegram-login', 'Swimming_Coaches_Association_bot');
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    s.setAttribute('data-request-access', 'write');
    s.setAttribute('data-userpic', 'false');
    s.setAttribute('data-lang', 'ru');
    c.appendChild(s);
    return () => { delete window.onTelegramAuth; };
  }, [linked, linkTelegram, refreshUser]);

  const handleUnlink = async () => {
    if (!confirm('Отвязать Telegram? Доступ к платному контенту может пропасть.')) return;
    setError(null); setSuccess(null); setBusy(true);
    const err = await unlinkTelegram();
    setBusy(false);
    if (err) setError(err);
    else { setSuccess('Telegram отвязан.'); await refreshUser(); }
  };

  return (
    <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
      <h3 className="text-white font-bold mb-1 flex items-center gap-2">
        <Send size={18} className="text-[#229ED9]" /> Telegram
      </h3>
      <p className="text-zinc-500 text-xs mb-4">
        Привяжите Telegram, чтобы открыть доступ к контенту по активной подписке Tribute.
      </p>

      {linked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
            {user?.telegram_photo_url
              ? <img src={user.telegram_photo_url} className="w-10 h-10 rounded-full" />
              : <div className="w-10 h-10 rounded-full bg-[#229ED9]/20 flex items-center justify-center text-[#229ED9] font-bold">
                  {(user?.telegram_first_name?.[0] ?? 'T').toUpperCase()}
                </div>}
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm truncate">
                {[user?.telegram_first_name, user?.telegram_last_name].filter(Boolean).join(' ') || 'Telegram'}
              </p>
              {user?.telegram_username && <p className="text-zinc-500 text-xs">@{user.telegram_username}</p>}
              <p className="text-zinc-600 text-xs">ID: {user?.telegram_id}</p>
            </div>
            <Link2 size={18} className="text-green-400 shrink-0" />
          </div>
          <button
            onClick={handleUnlink}
            disabled={busy}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-red-400 rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Unlink size={16} /> Отвязать Telegram
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="flex justify-center [&>iframe]:rounded-2xl" />
      )}

      {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}
      {success && <p className="text-green-400 text-sm text-center mt-3">{success}</p>}
      {busy && <p className="text-zinc-500 text-xs text-center mt-2">Обработка…</p>}
    </div>
  );
};
