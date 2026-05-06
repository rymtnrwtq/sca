import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Play, Lock, Crown, User as UserIcon } from 'lucide-react';
import { Lesson, DownloadItem } from '../types';
import { VideoPlayerView } from '../components/video/VideoPlayerView';
import { useAuth } from '../contexts/AuthContext';
import { loadWatchHistory } from '../utils/localStorage';

interface WatchState {
  video?: Lesson;
}

export const WatchVideo = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tier } = useAuth();
  const stateVideo = (location.state as WatchState | null)?.video ?? null;

  const [video, setVideo] = useState<Lesson | null>(stateVideo?.id === videoId ? stateVideo : null);
  const [allVideos, setAllVideos] = useState<Lesson[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>(stateVideo?.downloads ?? []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!videoId) return;

    // Show state video instantly to avoid flicker, but always fetch full data
    if (stateVideo?.id === videoId) {
      setVideo(stateVideo);
      setDownloads(stateVideo.downloads ?? []);
    } else {
      setVideo(null);
      setAllVideos([]);
    }
    setLoading(true);

    const loadRandomVideos = async (currentVideoId: string) => {
      try {
        // Collect watched video IDs (progress >= 70%) from localStorage
        const history = loadWatchHistory();
        const watchedIds = history
          .filter(h => h.progress >= 70)
          .map(h => h.videoId);
        const excludeIds = [currentVideoId, ...watchedIds].join(',');
        const r = await fetch(`/api/random-videos?exclude=${excludeIds}&n=6`);
        if (r.ok) {
          const d = await r.json();
          const vids: Lesson[] = (d.videos ?? []).map((v: any) => ({
            id: v.id, title: v.title, description: v.description,
            embedUrl: v.embedUrl, posterUrl: v.posterUrl,
            duration: v.duration, durationSec: v.durationSec,
          }));
          setAllVideos(vids);
        }
      } catch {}
    };

    const load = async () => {
      try {
        // Try fetching from content.json + Kinescope metadata
        const r = await fetch(`/api/video-from-json/${videoId}`);
        if (r.ok) {
          const data = await r.json();
          // Handle both old { video: ... } wrapper and new flat response
          const d = data.video ?? data;
          if (d?.id) {
            const v: Lesson = {
              id: d.id,
              title: d.title,
              description: d.description,
              embedUrl: d.embedUrl,
              posterUrl: d.posterUrl,
              duration: d.duration,
              durationSec: d.durationSec,
              chapters: d.chapters,
              downloads: d.downloads,
              seminarTitle: d.seminarTitle,
            };
            setVideo(v);
            setDownloads(d.downloads ?? []);

            // Load random unwatched recommendations
            loadRandomVideos(v.id);
            return;
          }
        }

        // Fallback: Kinescope only
        const r2 = await fetch(`/api/videos/by-ids?ids=${videoId}`);
        if (r2.ok) {
          const data: { videos: Lesson[] } = await r2.json();
          const found = data.videos[0] ?? null;
          setVideo(found);
          if (found) loadRandomVideos(found.id);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [videoId]);

  if (tier !== 'premium') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-24 h-24 bg-zinc-900 rounded-[28px] flex items-center justify-center text-orange-500 mb-6">
          <Lock size={44} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Видео закрыто</h2>
        {tier === 'guest' ? (
          <>
            <p className="text-zinc-500 mb-8 max-w-xs">
              Зарегистрируйтесь и оформите подписку, чтобы смотреть видео
            </p>
            <button
              onClick={() => navigate('/auth?tab=register')}
              className="w-full max-w-xs py-4 bg-white text-black rounded-2xl font-bold text-lg transition-all hover:bg-zinc-100 flex items-center justify-center gap-2 mb-3"
            >
              <UserIcon size={20} />
              Зарегистрироваться
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="w-full max-w-xs py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
            >
              <Crown size={20} />
              Войти
            </button>
          </>
        ) : (
          <>
            <p className="text-zinc-500 mb-8 max-w-xs">
              Оформите подписку, чтобы открыть все видео и курсы
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="w-full max-w-xs py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
            >
              <Crown size={20} />
              Оформить подписку
            </button>
          </>
        )}
      </div>
    );
  }

  if (loading && !video) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 mb-6">
          <Play size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Видео не найдены</h2>
        <p className="text-zinc-500 mb-8">Возможно, ссылка устарела или видео было удалено</p>
        <button onClick={() => navigate(-1)} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-colors">
          Вернуться назад
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24 md:pb-6">
      <VideoPlayerView
        video={video}
        videos={allVideos}
        loading={false}
        downloads={downloads}
        onBack={() => navigate('/learn')}
        onPlay={(v) => {
          navigate(`/watch/${v.id}`, { state: { video: v } });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </motion.div>
  );
};
