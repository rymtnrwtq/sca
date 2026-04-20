import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, History, Play, X, Clock } from 'lucide-react';
import { 
  loadWatchHistory, 
  removeFromHistory, 
  WatchHistoryEntry 
} from '../utils/localStorage';

export const HistoryPage = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<WatchHistoryEntry[]>(loadWatchHistory());

  useEffect(() => {
    const update = () => setHistory(loadWatchHistory());
    window.addEventListener('sca_history_update', update);
    return () => window.removeEventListener('sca_history_update', update);
  }, []);

  const handleRemove = (videoId: string) => {
    removeFromHistory(videoId);
  };

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин. назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч. назад`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'вчера';
    return `${days} дн. назад`;
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-24 md:pb-6">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors">
          <ChevronRight size={24} className="rotate-180" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">История</h1>
          <p className="text-zinc-500">Видео, которые вы смотрели ранее</p>
        </div>
      </header>

      {history.length === 0 ? (
        <div className="bg-zinc-900 border border-white/5 rounded-[40px] p-8 sm:p-12 text-center">
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-zinc-600 mx-auto mb-6">
            <History size={32} />
          </div>
          <p className="text-zinc-400 text-lg mb-2">История пуста</p>
          <p className="text-zinc-600">Начните смотреть материалы, чтобы они появились здесь</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(item => (
            <div key={item.videoId} className="bg-zinc-900/40 border border-white/5 rounded-3xl p-3 sm:p-4 flex gap-3 sm:gap-5 group hover:bg-zinc-900 hover:border-white/10 transition-all">
              <Link to={`/watch/${item.videoId}`} className="block shrink-0">
                <div className="w-24 sm:w-36 md:w-44 aspect-video relative bg-zinc-950 rounded-2xl overflow-hidden">
                  {item.posterUrl
                    ? <img src={item.posterUrl} alt={item.title} loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Play size={20} /></div>
                  }
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                    {item.progress > 0 && <span className="text-orange-500">{item.progress}%</span>}
                    {item.duration}
                  </span>
                  {item.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                      <div className="h-full bg-orange-500" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/watch/${item.videoId}`} className="flex-1">
                    <h3 className="text-white font-bold text-sm sm:text-base mb-1 line-clamp-2 hover:text-orange-400 transition-colors">{item.title}</h3>
                  </Link>
                  <button
                    onClick={() => handleRemove(item.videoId)}
                    className="p-2 text-zinc-700 hover:text-red-400 transition-colors rounded-xl hover:bg-white/5 shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-500 text-xs mt-1">
                  <span className="flex items-center gap-1.5"><Clock size={12} /> {formatTimeAgo(item.lastWatched)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
