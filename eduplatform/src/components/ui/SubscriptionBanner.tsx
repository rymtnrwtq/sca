import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const SubscriptionBanner = () => {
  const { tier } = useAuth();
  const navigate = useNavigate();

  if (tier === 'premium') return null;

  if (tier === 'guest') {
    return (
      <div className="bg-zinc-900 border border-white/5 p-6 rounded-[32px] flex items-center justify-between group overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-500/[0.05] opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-400">
            <UserIcon size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white">Вы не авторизованы</h3>
            <p className="text-sm text-zinc-500">Зарегистрируйтесь, чтобы сохранять прогресс и историю</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/auth')}
          className="relative px-6 py-2.5 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-100 transition-all active:scale-95"
        >
          Войти
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-600 to-orange-500 p-6 rounded-[32px] text-white shadow-2xl shadow-orange-500/20 flex items-center justify-between group overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-110 transition-transform duration-700" />
      <div className="relative flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white">
          <Crown size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg leading-tight">Откройте все курсы</h3>
          <p className="text-sm opacity-80">Получите полный доступ ко всем материалам</p>
        </div>
      </div>
      <button
        onClick={() => navigate('/profile')}
        className="relative px-6 py-2.5 bg-white text-orange-600 rounded-xl font-bold text-sm hover:bg-zinc-100 transition-all active:scale-95 shadow-xl"
      >
        Подписаться
      </button>
    </div>
  );
};
