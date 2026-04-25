import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellDot, Bookmark, ChevronRight, History, Play, Crown, Radio, Tv2, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LandingPage } from './LandingPage';
import {
  loadWatchHistory,
  loadWatchLater,
  getWatchProgress,
  WatchHistoryEntry,
  WatchLaterEntry
} from '../utils/localStorage';
import { SubscriptionBanner } from '../components/ui/SubscriptionBanner';
import { Lesson } from '../types';

interface UserNotification {
  id: number;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

function useNotifications(user: any) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  const load = useCallback(async () => {
    if (!user || user.tier === 'guest') return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/notifications', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const d = await res.json();
      setNotifications(d.notifications || []);
    } catch {}
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    for (const n of unread) {
      try {
        const token = localStorage.getItem('auth_token');
        await fetch(`/api/notifications/${n.id}/read`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch {}
    }
  };

  return { notifications, markRead, markAllRead };
}

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [watchLater, setWatchLater] = useState<WatchLaterEntry[]>(loadWatchLater());
  const [history, setHistory] = useState<WatchHistoryEntry[]>(loadWatchHistory());
  const [liveBroadcast, setLiveBroadcast] = useState<{ active: boolean; embed_url?: string; event_id?: string | null } | null>(null);
  const [lastBroadcast, setLastBroadcast] = useState<Lesson | null>(null);
  const [lastBroadcastProgress, setLastBroadcastProgress] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { notifications, markRead, markAllRead } = useNotifications(user);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  useEffect(() => {
    const upHistory = () => {
      setHistory(loadWatchHistory());
      if (lastBroadcast) {
        setLastBroadcastProgress(getWatchProgress(lastBroadcast.id).progress);
      }
    };
    const upLater = () => setWatchLater(loadWatchLater());
    window.addEventListener('sca_history_update', upHistory);
    window.addEventListener('sca_watch_later_update', upLater);
    return () => {
      window.removeEventListener('sca_history_update', upHistory);
      window.removeEventListener('sca_watch_later_update', upLater);
    };
  }, [lastBroadcast]);

  useEffect(() => {
    fetch('/api/live-broadcast')
      .then(r => r.ok ? r.json() : { active: false })
      .then(d => setLiveBroadcast(d));
  }, []);

  useEffect(() => {
    fetch('/api/latest-broadcast-video')
      .then(r => {
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null;
        return r.json();
      })
      .then(d => {
        const video: Lesson | undefined = d?.video;
        if (video) {
          setLastBroadcast(video);
          setLastBroadcastProgress(getWatchProgress(video.id).progress);
        }
      })
      .catch(() => {});
  }, []);

  if (!user) return <LandingPage />;

  const displayName = user?.name ?? 'Гость';
  const subscriptionExpires = user?.subscription_expires_at;

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 pb-24 md:pb-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-zinc-500 text-xs sm:text-[13px] font-bold uppercase tracking-[0.15em] mb-1">Swimming Coaches Association</h2>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">Привет, {displayName}!</h1>
          {subscriptionExpires && (
            <div className="flex items-center gap-2 mt-2 text-orange-500/80">
              <Crown size={13} className="fill-current shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {(() => {
                  const date = new Date(subscriptionExpires);
                  const diffMs = date.getTime() - Date.now();
                  const diffHours = Math.ceil(diffMs / 3600_000);
                  const diffDays = Math.floor(diffMs / 86400_000);
                  const dateStr = date.toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                  if (diffMs <= 0) return `Подписка истекла`;
                  if (diffHours <= 48) return `Подписка: осталось ${diffHours} ч. (до ${dateStr})`;
                  return `Подписка: ${diffDays} дн. (до ${dateStr})`;
                })()}
              </span>
            </div>
          )}
        </div>

        {/* Bell with notification dropdown */}
        {user && user.tier !== 'guest' && (
          <div ref={notifRef} className="relative shrink-0">
            <button
              onClick={() => setNotifOpen(v => !v)}
              className="relative w-11 h-11 flex items-center justify-center bg-zinc-900 border border-white/5 rounded-2xl text-zinc-400 hover:text-white hover:border-white/10 transition-all"
            >
              {unreadCount > 0 ? <BellDot size={20} className="text-blue-400" /> : <Bell size={20} />}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-lg">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 z-50 w-[min(340px,calc(100vw-24px))] bg-zinc-900 border border-white/10 rounded-[24px] shadow-2xl shadow-black/60 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <span className="text-white font-black text-sm">Уведомления</span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Прочитать все
                        </button>
                      )}
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-white transition-colors rounded-xl hover:bg-white/5"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[min(400px,60vh)] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell size={28} className="mx-auto mb-3 text-zinc-700" />
                        <p className="text-zinc-500 text-sm font-bold">Нет уведомлений</p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {notifications.map(n => (
                          <button
                            key={n.id}
                            onClick={() => markRead(n.id)}
                            className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-3 ${
                              n.read
                                ? 'opacity-50 hover:opacity-70'
                                : 'bg-blue-500/5 hover:bg-blue-500/10'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-transparent' : 'bg-blue-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold leading-snug ${n.read ? 'text-zinc-400' : 'text-white'}`}>
                                {n.title}
                              </p>
                              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-zinc-600 mt-1">
                                {new Date(n.created_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {!n.read && <Check size={14} className="text-zinc-600 shrink-0 mt-0.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </header>

      <SubscriptionBanner />

      {lastBroadcast && (
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest">Последний эфир</span>
          </div>
          <Link
            to={`/watch/${lastBroadcast.id}`}
            state={{ video: lastBroadcast }}
            className="group flex md:flex-row flex-col md:items-center gap-0 md:gap-4 relative bg-zinc-900 border border-white/5 rounded-[28px] overflow-hidden hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300"
          >
            <div className="aspect-video md:aspect-auto md:w-56 md:h-32 md:shrink-0 relative bg-zinc-950">
              {lastBroadcast.posterUrl
                ? <img src={lastBroadcast.posterUrl} alt={lastBroadcast.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
                : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Tv2 size={32} /></div>
              }
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent md:hidden" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Play size={16} className="text-white ml-0.5" fill="currentColor" />
              </div>
              {lastBroadcastProgress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" style={{ width: `${lastBroadcastProgress}%` }} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 p-4 md:py-3 md:px-0 md:pr-4">
              <p className="text-white font-bold text-sm md:text-base leading-snug line-clamp-2 group-hover:text-orange-400 transition-colors">{lastBroadcast.title}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="bg-white/5 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {lastBroadcast.duration}
                </span>
                {lastBroadcastProgress > 0 && (
                  <span className="text-orange-400 text-[10px] font-bold">{lastBroadcastProgress}% просмотрено</span>
                )}
              </div>
            </div>
          </Link>
        </section>
      )}

      {liveBroadcast?.active && (
        <section>
          <button
            onClick={() => navigate('/live')}
            className="group w-full relative flex items-center gap-4 p-4 sm:p-5 bg-gradient-to-r from-red-950/50 to-zinc-900/80 border border-red-500/30 rounded-[28px] text-left hover:border-red-500/50 hover:shadow-xl hover:shadow-red-500/15 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/[0.04] transition-all duration-500" />
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-red-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-red-500/40 group-hover:scale-105 transition-transform">
              <Radio size={22} className="text-white" />
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">Прямой эфир</span>
              </div>
              <p className="text-white font-bold text-sm sm:text-base leading-snug">Присоединиться к трансляции</p>
              <p className="text-zinc-500 text-xs mt-0.5 hidden sm:block">Плеер + чат, откроется во весь экран</p>
            </div>
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-white/5 group-hover:bg-red-500 rounded-2xl flex items-center justify-center shrink-0 transition-all">
              <Play size={18} className="text-zinc-400 group-hover:text-white ml-0.5 transition-colors" fill="currentColor" />
            </div>
          </button>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4 sm:mb-5 px-1 gap-4">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
              <Bookmark size={18} />
            </div>
            Закрепленные
          </h3>
          {watchLater.length > 0 && (
            <button
              onClick={() => navigate('/bookmarks')}
              className="group flex items-center gap-1 text-orange-500 hover:text-orange-400 text-sm font-bold transition-all whitespace-nowrap"
            >
              Все
              <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {watchLater.length === 0 ? (
          <div className="bg-zinc-900/30 border border-dashed border-white/10 rounded-[28px] p-6 sm:p-8 text-center">
            <p className="text-zinc-500 text-sm">Здесь будут видео, которые вы сохраните</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 scroll-pl-4 snap-x snap-mandatory">
            {watchLater.slice(0, 6).map(item => {
              const { progress } = getWatchProgress(item.videoId);
              return (
                <div key={item.videoId} className="group relative shrink-0 w-[68vw] max-w-[260px] sm:w-[45vw] sm:max-w-[300px] snap-start">
                  <Link to={`/watch/${item.videoId}`} className="block">
                    <div className="bg-zinc-900 border border-white/5 rounded-[24px] overflow-hidden transition-all duration-300 group-hover:border-white/10 group-hover:shadow-2xl group-hover:shadow-orange-500/5">
                      <div className="aspect-video relative bg-zinc-950">
                        {item.posterUrl
                          ? <img src={item.posterUrl} alt={item.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                          : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Play size={28} /></div>
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                        <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                          {progress > 0 && <span className="text-orange-500">{progress}%</span>}
                          {item.duration}
                        </span>
                        {progress > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                            <div className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-white text-xs sm:text-sm font-bold leading-tight line-clamp-2 transition-colors group-hover:text-orange-400">{item.title}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 sm:mb-5 px-1 gap-4">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 shrink-0">
              <History size={18} />
            </div>
            История
          </h3>
          {history.length > 0 && (
            <button
              onClick={() => navigate('/history')}
              className="group flex items-center gap-1 text-zinc-400 hover:text-white text-sm font-bold transition-all whitespace-nowrap"
            >
              Вся
              <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="bg-zinc-900/30 border border-dashed border-white/10 rounded-[28px] p-6 sm:p-8 text-center">
            <p className="text-zinc-500 text-sm">Вы еще не посмотрели ни одного видео</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 3).map(item => (
              <Link
                key={item.videoId}
                to={`/watch/${item.videoId}`}
                className="flex items-center gap-3 bg-zinc-900/40 border border-white/5 rounded-2xl p-2.5 group hover:bg-zinc-900 hover:border-white/10 transition-all"
              >
                <div className="w-24 sm:w-32 md:w-40 aspect-video relative bg-zinc-950 rounded-xl overflow-hidden shrink-0">
                  {item.posterUrl
                    ? <img src={item.posterUrl} alt={item.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Play size={14} /></div>
                  }
                  <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-white text-[11px] font-bold px-1.5 py-0.5 rounded border border-white/5 flex items-center gap-1">
                    {item.progress > 0 && <span className="text-orange-500">{item.progress}%</span>}
                    {item.duration}
                  </span>
                  {item.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
                      <div className="h-full bg-orange-500" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold leading-snug line-clamp-2 group-hover:text-orange-400 transition-colors">{item.title}</p>
                  <div className="mt-1">
                    <span className="text-zinc-500 text-xs">{formatTimeAgo(item.lastWatched)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
};
