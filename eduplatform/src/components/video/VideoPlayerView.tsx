import React, { useState, useEffect } from 'react';
import { Clock, Bookmark, BookmarkCheck, History, ChevronRight, Download, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lesson, DownloadItem } from '../../types';
import { cn } from '../../lib/utils';
import {
  addToWatchHistory,
  getWatchPosition,
  toggleWatchLater,
  updateWatchPosition,
} from '../../utils/localStorage';
import { useIsInWatchLater } from '../../hooks/useIsInWatchLater';
import { VideoListCompact } from './VideoListCompact';

export const VideoPlayerView = ({
  video,
  videos,
  loading,
  downloads,
  onPlay,
  onBack,
}: {
  video: Lesson;
  videos: Lesson[];
  loading: boolean;
  downloads?: DownloadItem[];
  onClose?: () => void;
  onPlay: (v: Lesson) => void;
  onBack?: () => void;
}) => {
  // Merge downloads from prop and from video object
  const allDownloads = downloads ?? video.downloads ?? [];
  const inWatchLater = useIsInWatchLater(video.id, video.embedUrl ?? undefined);
  const [showDownloads, setShowDownloads] = useState(false);

  useEffect(() => {
    addToWatchHistory(video, getWatchPosition(video.id));
  }, [video.id]);

  const handleToggleWatchLater = () => {
    toggleWatchLater(video);
  };

  const [showResumeMsg, setShowResumeMsg] = useState(false);
  const initialPos = getWatchPosition(video.id);

  useEffect(() => {
    let playerInstance: any = null;
    const iframeId = `kinescope-player-${video.id}`;

    const initKinescope = async () => {
      // Ensure script is loaded
      if (!(window as any).Kinescope) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://player.kinescope.io/latest/iframe.player.js';
          script.async = true;
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      const factory = (window as any).Kinescope?.IframePlayer;
      if (!factory) {
        console.error('Kinescope SDK not available');
        return;
      }

      try {
        const container = document.getElementById(iframeId);
        if (!container) return;
        
        // Clean container just in case
        container.innerHTML = '';

        playerInstance = await factory.create(iframeId, {
          url: video.embedUrl ?? '',
          size: { width: '100%', height: '100%' },
          behavior: { 
            playsInline: true, 
            autoPlay: true,
            preload: 'auto'
          }
        });

        if (initialPos > 5) {
          playerInstance.seekTo(initialPos);
          setShowResumeMsg(true);
          setTimeout(() => setShowResumeMsg(false), 5000);
        }

        let lastSaved = 0;
        playerInstance.on(playerInstance.Events.TimeUpdate, (event: any) => {
          const currentTime = event.data.currentTime;
          if (Math.abs(currentTime - lastSaved) >= 5) {
            lastSaved = currentTime;
            updateWatchPosition(video.id, currentTime, video.durationSec);
          }
        });
        
        playerInstance.on(playerInstance.Events.Ended, () => {
             updateWatchPosition(video.id, video.durationSec, video.durationSec);
        });
      } catch (e) {
        console.error('Failed to initialize Kinescope player', e);
      }
    };

    initKinescope();

    return () => {
      if (playerInstance) {
        try { playerInstance.destroy(); } catch {}
      }
    };
  }, [video.id, video.durationSec]);

  const formatPosition = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-5">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-orange-500 hover:text-orange-400 text-sm font-semibold transition-colors px-1 py-1">
          <ChevronRight size={18} className="rotate-180" /> Назад к списку
        </button>
      )}
      <div className="relative aspect-video bg-zinc-950 rounded-2xl md:rounded-3xl overflow-hidden border border-white/5 shadow-2xl shadow-black/50">
        <div id={`kinescope-player-${video.id}`} className="w-full h-full" />
        <AnimatePresence>
          {showResumeMsg && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-6 left-6 z-10 bg-black/80 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-2xl"
            >
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white shrink-0">
                <History size={16} />
              </div>
              <div>
                <p className="text-white text-xs font-bold leading-tight">Продолжаем просмотр</p>
                <p className="text-zinc-400 text-[10px]">Остановились на {formatPosition(initialPos)}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-1 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-base sm:text-lg md:text-xl leading-snug break-words">{video.title}</h2>
          <div className="flex flex-wrap gap-3 mt-1.5 text-zinc-500 text-sm">
            <span className="flex items-center gap-1.5"><Clock size={14} /> {video.duration}</span>
          </div>
        </div>
        <button
          onClick={handleToggleWatchLater}
          className={cn(
            "shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
            inWatchLater
              ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
              : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
          )}
        >
          {inWatchLater ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          <span className="hidden sm:inline">{inWatchLater ? 'В списке' : 'Смотреть позже'}</span>
        </button>
      </div>

      {video.description && (
        <div className="px-1">
          <p className="text-zinc-400 text-sm leading-relaxed">{video.description}</p>
        </div>
      )}

      {allDownloads.length > 0 && (
        <>
          <div className="border-t border-white/5" />
          <div>
            <button
              onClick={() => setShowDownloads(v => !v)}
              className="flex items-center gap-3 w-full px-2 py-1 group"
            >
              <div className="flex items-center gap-2 flex-1">
                <Download size={15} className="text-orange-500 shrink-0" />
                <span className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">
                  Материалы
                </span>
                <span className="text-zinc-600 text-xs font-medium bg-white/5 px-2 py-0.5 rounded-full">
                  {allDownloads.length}
                </span>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {showDownloads && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2 mt-3">
                    {allDownloads.map((dl, i) => (
                      <a
                        key={i}
                        href={dl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-orange-500/20 rounded-2xl transition-all group"
                      >
                        <div className="w-9 h-9 bg-orange-500/10 group-hover:bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                          {dl.type === 'google_drive' ? (
                            <ExternalLink size={15} className="text-orange-500" />
                          ) : (
                            <Download size={15} className="text-orange-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold group-hover:text-orange-400 transition-colors line-clamp-2 leading-snug">
                            {dl.title}
                          </p>
                          <p className="text-zinc-600 text-xs mt-0.5">
                            {dl.type === 'google_drive' ? 'Google Drive' : 'Скачать'}
                          </p>
                        </div>
                        <ChevronRight size={15} className="text-zinc-600 group-hover:text-orange-500 shrink-0 transition-colors" />
                      </a>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      <div className="border-t border-white/5" />

      <div>
        <h3 className="text-zinc-400 font-semibold text-sm uppercase tracking-wider mb-3 pl-2">Другие видео</h3>
        <VideoListCompact
          videos={videos.filter(v => v.id !== video.id).slice(0, 3)}
          loading={loading}
          activeVideo={video}
          onPlay={onPlay}
        />
      </div>
    </div>
  );
};
