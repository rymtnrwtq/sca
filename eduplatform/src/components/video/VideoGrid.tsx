import React, { useState, useRef, useEffect } from 'react';
import { Play, Bookmark, MoreVertical, CheckCircle, EyeOff, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lesson } from '../../types';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { PaywallModal } from '../ui/PaywallModal';
import {
  getWatchProgress,
  loadHiddenVideos,
  toggleWatchLater,
  toggleForcedWatched,
  toggleHideVideo,
} from '../../utils/localStorage';
import { useIsInWatchLater } from '../../hooks/useIsInWatchLater';

// ── Single video card ────────────────────────────────────────────────────────

const VideoCard = ({
  video,
  isActive,
  onPlay,
  menuRef,
  menuOpenId,
  setMenuOpenId,
}: {
  video: Lesson;
  isActive: boolean;
  onPlay: (v: Lesson) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
}) => {
  const [, forceUpdate] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { tier } = useAuth();
  const isPremium = tier === 'premium';

  useEffect(() => {
    const update = () => forceUpdate(v => v + 1);
    window.addEventListener('sca_history_update', update);
    return () => window.removeEventListener('sca_history_update', update);
  }, []);

  const { progress } = getWatchProgress(video.id);
  const pinned = useIsInWatchLater(video.id, video.embedUrl ?? undefined);
  const isMenuOpen = menuOpenId === video.id;
  const hiddenIds = loadHiddenVideos();
  const isHidden = hiddenIds.includes(video.id);

  return (
    <div className="relative group/card">
      <button
        onClick={() => {
          if (!isPremium) { setPaywallOpen(true); return; }
          onPlay(video);
        }}
        className={cn(
          "w-full text-left group transition-all rounded-2xl",
          isActive && "ring-2 ring-orange-500"
        )}
      >
        <div className="aspect-video relative bg-zinc-900 rounded-2xl overflow-hidden">
          {video.posterUrl
            ? <img src={video.posterUrl} alt={video.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="absolute inset-0 w-full h-full flex items-center justify-center text-zinc-700"><Play size={32} /></div>
          }
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {pinned && (
            <div className="absolute top-2.5 left-2.5 bg-orange-500 text-white p-1.5 rounded-lg shadow-lg">
              <Bookmark size={14} fill="currentColor" />
            </div>
          )}

          {!isPremium && (
            <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md text-white p-2 rounded-xl border border-white/10 z-20">
              <Lock size={16} className="text-orange-500" />
            </div>
          )}

          <span className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg z-10 border border-white/5 flex items-center gap-1.5">
            {progress > 0 && <span className="text-orange-500">{progress}%</span>}
            {video.duration}
          </span>

          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-10">
              <div className="h-full bg-orange-500 transition-all shadow-[0_0_8px_rgba(249,115,22,0.6)]" style={{ width: `${progress}%` }} />
            </div>
          )}

          {isActive && (
            <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center z-10">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Play fill="white" size={18} className="text-white ml-0.5" />
              </div>
            </div>
          )}
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Play fill="white" size={22} className="text-white ml-0.5" />
              </div>
            </div>
          )}
        </div>
        <div className="pt-3 px-1 relative">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              "text-[15px] font-semibold leading-snug line-clamp-2 transition-colors",
              isActive ? "text-orange-400" : "text-white group-hover:text-orange-300"
            )}>
              {video.title}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : video.id);
              }}
              className={cn(
                "shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all z-20",
                isMenuOpen ? "text-orange-500 bg-orange-500/10" : "text-zinc-400 hover:text-white hover:bg-white/10"
              )}
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>
      </button>

      <PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} requiredTier="premium" />

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-12 right-0 z-30 w-56 max-w-[calc(100vw-32px)] bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-1.5"
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleWatchLater(video); setMenuOpenId(null); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors text-left"
            >
              <div className="w-5 flex justify-center">
                <Bookmark size={16} className={pinned ? "text-orange-500" : ""} fill={pinned ? "currentColor" : "none"} />
              </div>
              <span>{pinned ? 'Убрать из избранного' : 'В избранное'}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleForcedWatched(video); setMenuOpenId(null); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors text-left"
            >
              <div className="w-5 flex justify-center">
                <CheckCircle size={16} className={progress >= 95 ? "text-green-500" : ""} />
              </div>
              <span>{progress >= 95 ? 'Сбросить прогресс' : 'Отметить просмотренным'}</span>
            </button>
            <div className="h-px bg-white/5 my-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleHideVideo(video.id);
                setMenuOpenId(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-left"
            >
              <div className="w-5 flex justify-center">
                {isHidden ? <Play size={16} className="rotate-180" /> : <EyeOff size={16} />}
              </div>
              <span>{isHidden ? 'Вернуть в список' : 'Скрыть из списка'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── VideoGrid ────────────────────────────────────────────────────────────────

export const VideoGrid = ({
  videos,
  loading,
  activeVideo,
  onPlay,
}: {
  videos: Lesson[];
  loading: boolean;
  activeVideo: Lesson | null;
  onPlay: (v: Lesson) => void;
}) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-video bg-zinc-800/80 rounded-2xl relative overflow-hidden">
              <div className="absolute bottom-2.5 right-2.5 w-14 h-5 bg-zinc-700 rounded-lg" />
            </div>
            <div className="pt-3 px-1 space-y-2">
              <div className="h-4 bg-zinc-800 rounded-lg w-full" />
              <div className="h-4 bg-zinc-800 rounded-lg w-3/4" />
              <div className="h-3 bg-zinc-800/60 rounded-lg w-1/3 mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!videos.length) return <div className="text-zinc-500 text-base py-12 text-center">Видео не найдены</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
      {videos.map(video => (
        <VideoCard
          key={video.id}
          video={video}
          isActive={activeVideo?.id === video.id}
          onPlay={onPlay}
          menuRef={menuRef}
          menuOpenId={menuOpenId}
          setMenuOpenId={setMenuOpenId}
        />
      ))}
    </div>
  );
};
