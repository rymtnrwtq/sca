import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Crown, ArrowLeft, CheckCircle2, Gift, Users, ExternalLink, Copy, Check,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const TRIBUTE_BUY     = 'https://web.tribute.tg/s/kCa';
const TRIBUTE_MANAGE  = 'https://t.me/tribute/app?profile';
const TRIBUTE_GIFT    = 'https://t.me/tribute/app?startapp=skCa';
const TRIBUTE_REF     = 'https://t.me/tribute/app?startapp=o5GanUTWxfbL';

export const SubscriptionPage = () => {
  const navigate = useNavigate();
  const { user, tier } = useAuth();
  const [copied, setCopied] = useState(false);

  const isActive = tier === 'premium' && user?.subscription_expires_at
    ? new Date(user.subscription_expires_at) > new Date()
    : false;

  const formatExpiry = (iso: string) => {
    const date = new Date(iso);
    const diffMs = date.getTime() - Date.now();
    const diffHours = Math.ceil(diffMs / 3600_000);
    const diffDays = Math.floor(diffMs / 86400_000);
    const dateStr = date.toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    if (diffMs <= 0) return `Истекла ${dateStr}`;
    if (diffHours <= 48) return `Осталось ${diffHours} ч. · до ${dateStr}`;
    return `Осталось ${diffDays} дн. · до ${dateStr}`;
  };

  const copyRef = async () => {
    await navigator.clipboard.writeText(TRIBUTE_REF);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-4 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-zinc-900 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Подписка</h1>
          <p className="text-zinc-500 text-sm">SCA Premium — полный доступ</p>
        </div>
      </div>

      {/* Current status */}
      <div className={cn(
        "p-5 rounded-3xl border",
        isActive ? "bg-orange-500/10 border-orange-500/20" : "bg-zinc-900 border-white/5"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isActive ? "bg-orange-500" : "bg-zinc-800")}>
            <Crown size={22} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold">{isActive ? 'Premium активна' : 'Бесплатный тариф'}</p>
            {isActive && user?.subscription_expires_at && (
              <p className="text-zinc-400 text-sm">{formatExpiry(user.subscription_expires_at)}</p>
            )}
            {!isActive && <p className="text-zinc-500 text-sm">Оформите подписку для полного доступа</p>}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <a
          href={TRIBUTE_BUY}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20"
        >
          <Crown size={18} />
          <span className="flex-1">Оформить подписку</span>
          <ExternalLink size={15} className="opacity-70" />
        </a>

        <a
          href={TRIBUTE_MANAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white rounded-2xl font-bold transition-all"
        >
          <Crown size={18} className="text-orange-500" />
          <span className="flex-1">Управление подпиской</span>
          <ExternalLink size={15} className="opacity-50" />
        </a>

        <a
          href={TRIBUTE_GIFT}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white rounded-2xl font-bold transition-all"
        >
          <Gift size={18} className="text-pink-400" />
          <span className="flex-1">Подарить подписку</span>
          <ExternalLink size={15} className="opacity-50" />
        </a>

        <button
          onClick={copyRef}
          className="w-full flex items-center gap-3 px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white rounded-2xl font-bold transition-all"
        >
          <Users size={18} className="text-blue-400" />
          <span className="flex-1 text-left">Реферальная ссылка</span>
          <span className="flex items-center gap-1.5 text-sm font-normal text-zinc-500">
            {copied ? <><Check size={14} className="text-green-400" /><span className="text-green-400">Скопировано</span></> : <><Copy size={14} />Скопировать</>}
          </span>
        </button>
      </div>

      {/* Features */}
      <div className="bg-zinc-900 border border-white/5 p-5 rounded-3xl">
        <h3 className="text-white font-bold mb-4">Что входит в Premium</h3>
        <ul className="space-y-2.5">
          {[
            'Полный доступ ко всем семинарам без ограничений',
            'Прямые эфиры SCA',
            'Материалы и мастер-классы',
            'Иностранные конференции',
          ].map(f => (
            <li key={f} className="flex items-center gap-3 text-zinc-300 text-sm">
              <CheckCircle2 size={16} className="text-orange-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};
