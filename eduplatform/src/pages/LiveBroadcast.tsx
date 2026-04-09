import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Radio, ChevronRight, MessageSquare, Crown, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CHAT_URL = 'https://kinescope.io/chat/0csUJYzAHfe3PcyMEVScmQ';

export const LiveBroadcast = () => {
  const navigate = useNavigate();
  const { tier } = useAuth();
  const [liveBroadcast, setLiveBroadcast] = useState<{ active: boolean; embed_url?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  if (tier !== 'premium') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-700 mb-6">
          <Lock size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Только для Premium</h2>
        <p className="text-zinc-500 mb-8 max-w-xs">Прямые эфиры доступны только пользователям с активной подпиской Premium</p>
        <button
          onClick={() => navigate('/profile')}
          className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20"
        >
          <Crown size={18} /> Оформить Premium
        </button>
      </div>
    );
  }

  useEffect(() => {
    fetch('/api/live-broadcast')
      .then(r => r.json())
      .then(data => setLiveBroadcast(data))
      .catch(e => console.error('Failed to load live broadcast', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!liveBroadcast?.active) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-700 mb-6">
          <Radio size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Эфир не активен</h2>
        <p className="text-zinc-500 mb-8">Сейчас нет активных трансляций. Заходите позже!</p>
        <button
          onClick={() => navigate('/learn')}
          className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all"
        >
          Вернуться к семинарам
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-28 md:pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center bg-zinc-900 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-all"
        >
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase italic">LIVE: Прямой эфир</h1>
        </div>
      </div>

      {/* 16:9 Player */}
      <div
        className="relative w-full bg-black rounded-[32px] overflow-hidden border border-white/5 shadow-2xl"
        style={{ paddingTop: '56.25%' }}
      >
        <iframe
          src={liveBroadcast.embed_url}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      </div>

      {/* Kinescope Chat */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-[28px] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-500">
            <MessageSquare size={14} />
          </div>
          <span className="text-white font-black text-sm uppercase tracking-widest">Чат трансляции</span>
        </div>
        <div className="h-[300px] sm:h-[400px] md:h-[520px]">
          <iframe
            src={CHAT_URL}
            allow="fullscreen"
            frameBorder="0"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    </motion.div>
  );
};
