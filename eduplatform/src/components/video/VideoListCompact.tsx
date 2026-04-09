import React, { useState, useEffect } from 'react';
import { Play, Lock } from 'lucide-react';
import { Lesson } from '../../types';
import { cn } from '../../lib/utils';
import { getWatchProgress } from '../../utils/localStorage';
import { useAuth } from '../../contexts/AuthContext';
import { PaywallModal } from '../ui/PaywallModal';

export const VideoListCompact = ({
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
  const [, forceUpdate] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { tier } = useAuth();
  const isPremium = tier === 'premium';
  useEffect(() => {
    const update = () => forceUpdate(v => v + 1);
    window.addEventListener('sca_history_update', update);
    return () => window.removeEventListener('sca_history_update', update);
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse flex gap-3">
            <div className="w-28 sm:w-32 aspect-video bg-zinc-800 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 bg-zinc-800 rounded w-3/4" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!videos.length) return <div className="text-zinc-500 text-sm py-8 text-center">Видео не найдены</div>;
  return (
    <>
    <PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} requiredTier="premium" />
    <div className="space-y-1">
      {videos.map((video) => {
        const isActive = activeVideo?.id === video.id;
        const progress = getWatchProgress(video.id).progress;
        return (
          <button
            key={video.id}
            onClick={() => { if (!isPremium) { setPaywallOpen(true); return; } onPlay(video); }}
            className={cn(
              "w-full flex gap-3 p-2 rounded-xl text-left transition-all group",
              isActive ? "bg-orange-500/10 border border-orange-500/20" : "hover:bg-white/5 border border-transparent"
            )}
          >
            <div className="w-28 sm:w-32 aspect-video relative bg-zinc-900 rounded-lg overflow-hidden shrink-0">
              {video.posterUrl
                ? <img src={video.posterUrl} alt={video.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Play size={16} /></div>
              }
              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                {progress > 0 && <span className="text-orange-500">{progress}%</span>}
                {video.duration}
              </span>
              {progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                  <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              {!isPremium && (
                <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-md p-1 rounded-lg z-10">
                  <Lock size={12} className="text-orange-500" />
                </div>
              )}
              {isActive && (
                <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center">
                  <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center">
                    <Play fill="white" size={10} className="text-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <p className={cn(
                "text-sm font-medium leading-snug line-clamp-2",
                isActive ? "text-orange-400" : "text-zinc-200 group-hover:text-white"
              )}>
                {video.title}
              </p>
              <p className="text-zinc-600 text-xs mt-1">{video.duration}</p>
            </div>
          </button>
        );
      })}
    </div>
    </>
  );
};
