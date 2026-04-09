import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, Bookmark, Play, Trash2 } from 'lucide-react';
import { 
  loadWatchLater, 
  removeFromWatchLater, 
  getWatchProgress,
  WatchLaterEntry
} from '../utils/localStorage';

export const BookmarksPage = () => {
  const navigate = useNavigate();
  const [watchLater, setWatchLater] = useState<WatchLaterEntry[]>(loadWatchLater());

  useEffect(() => {
    const update = () => setWatchLater(loadWatchLater());
    window.addEventListener('sca_watch_later_update', update);
    return () => window.removeEventListener('sca_watch_later_update', update);
  }, []);

  const handleRemove = (videoId: string) => {
    removeFromWatchLater(videoId);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-24 md:pb-6">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors">
          <ChevronRight size={24} className="rotate-180" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Закрепленные</h1>
          <p className="text-zinc-500">Ваш список «Смотреть позже»</p>
        </div>
      </header>

      {watchLater.length === 0 ? (
        <div className="bg-zinc-900 border border-white/5 rounded-[40px] p-8 sm:p-12 text-center">
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-zinc-600 mx-auto mb-6">
            <Bookmark size={32} />
          </div>
          <p className="text-zinc-400 text-lg mb-2">Список пуст</p>
          <p className="text-zinc-600">Добавляйте видео в этот список, чтобы не потерять их</p>
          <button onClick={() => navigate('/learn')} className="mt-8 text-orange-500 font-bold hover:underline">
            Перейти к семинарам
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {watchLater.map(item => {
            const { progress } = getWatchProgress(item.videoId);
            return (
              <div key={item.videoId} className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden group relative transition-all hover:border-white/10">
                <Link to={`/watch/${item.videoId}`} className="block">
                  <div className="aspect-video relative bg-zinc-950">
                    {item.posterUrl
                      ? <img src={item.posterUrl} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                      : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Play size={28} /></div>
                    }
                    <span className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1.5">
                      {progress > 0 && <span className="text-orange-500">{progress}%</span>}
                      {item.duration}
                    </span>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                      <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center shadow-xl shadow-orange-500/20">
                        <Play fill="white" size={20} className="text-white ml-0.5" />
                      </div>
                    </div>
                    {progress > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
                        <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-3 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-white font-bold leading-snug line-clamp-2 group-hover:text-orange-400 transition-colors flex-1">{item.title}</h3>
                    <button
                      onClick={() => handleRemove(item.videoId)}
                      className="p-2 text-zinc-600 hover:text-red-400 transition-colors rounded-xl hover:bg-white/5 shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
