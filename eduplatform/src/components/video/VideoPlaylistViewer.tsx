import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, SlidersHorizontal, EyeOff, Bookmark, ExternalLink, FileText, Folder } from 'lucide-react';
import { SeminarLink } from '../../constants';
import { Lesson } from '../../types';
import {
  getWatchProgress,
  isInWatchLater,
  loadHiddenVideos
} from '../../utils/localStorage';
import { VideoGrid } from './VideoGrid';
import { Pagination } from '../ui/Pagination';
import { BottomSheet } from '../ui/BottomSheet';
import { cn } from '../../lib/utils';

type StatusFilter = 'all' | 'progress' | 'completed' | 'pinned' | 'hidden';

export const VideoPlaylistViewer = ({
  videoIds,
  title,
  links,
  onBack,
}: {
  videoIds: string[];
  title: string;
  links?: SeminarLink[];
  onBack: () => void;
}) => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [page, setPage] = useState(1);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const update = () => forceUpdate(v => v + 1);
    window.addEventListener('sca_history_update', update);
    window.addEventListener('sca_watch_later_update', update);
    return () => {
      window.removeEventListener('sca_history_update', update);
      window.removeEventListener('sca_watch_later_update', update);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/videos/by-ids?ids=${videoIds.join(',')}`)
      .then(r => r.ok ? r.json() : { videos: [] })
      .then((data: { videos: Lesson[] }) => {
        setVideos(data.videos);
      })
      .finally(() => setLoading(false));
  }, [videoIds.join(',')]);

  const hiddenIds = loadHiddenVideos();

  const filtered = videos.filter(v => {
    const { progress } = getWatchProgress(v.id);
    const isPinned = isInWatchLater(v.id);
    const isHidden = hiddenIds.includes(v.id);

    if (statusFilter === 'hidden') return isHidden;
    if (isHidden) return false;
    if (statusFilter === 'progress') return progress > 0 && progress < 95;
    if (statusFilter === 'completed') return progress >= 95;
    if (statusFilter === 'pinned') return isPinned;
    return true;
  });

  const counts: Record<StatusFilter, number> = {
    all: videos.filter(v => !hiddenIds.includes(v.id)).length,
    progress: videos.filter(v => { const p = getWatchProgress(v.id).progress; return p > 0 && p < 95 && !hiddenIds.includes(v.id); }).length,
    completed: videos.filter(v => getWatchProgress(v.id).progress >= 95 && !hiddenIds.includes(v.id)).length,
    pinned: videos.filter(v => isInWatchLater(v.id) && !hiddenIds.includes(v.id)).length,
    hidden: videos.filter(v => hiddenIds.includes(v.id)).length,
  };

  const PAGE_SIZE = 24;
  const totalFiltered = filtered.length;
  const displayTotalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-orange-500 hover:text-orange-400 text-sm font-semibold transition-colors w-fit">
            <ChevronRight size={18} className="rotate-180" /> Назад к списку
          </button>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">{title}</h2>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setIsFilterOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl text-sm font-bold text-white hover:bg-zinc-800 transition-all shrink-0"
            >
              <SlidersHorizontal size={18} className="text-orange-500" />
              Фильтры
              {statusFilter !== 'all' && (
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      <BottomSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Фильтры"
      >
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Статус</h4>
              {statusFilter !== 'all' && (
                <button 
                  onClick={() => {
                    setStatusFilter('all');
                    setPage(1);
                  }}
                  className="text-orange-500 text-[10px] font-bold uppercase tracking-wider hover:underline"
                >
                  Сбросить
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['all', 'progress', 'completed', 'pinned', 'hidden'] as StatusFilter[]).map(fKey => {
                const labels: Record<string, string> = { 
                  all: 'Все', 
                  progress: 'В процессе', 
                  completed: 'Завершенные', 
                  pinned: 'Избранное',
                  hidden: 'Скрытые'
                };
                const Icon = fKey === 'hidden' ? EyeOff : fKey === 'pinned' ? Bookmark : undefined;

                return (
                  <button
                    key={fKey}
                    onClick={() => { setStatusFilter(fKey); setPage(1); }}
                    className={cn(
                      "px-4 py-3 rounded-2xl text-sm font-bold transition-all border text-left flex justify-between items-center",
                      statusFilter === fKey
                        ? "bg-orange-500/10 border-orange-500/50 text-white"
                        : "bg-white/5 border-white/5 text-zinc-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {Icon && <Icon size={14} className={statusFilter === fKey ? "text-orange-500" : "text-zinc-600"} />}
                      {labels[fKey]}
                      <span className="text-[10px] opacity-50 font-medium">({counts[fKey]})</span>
                    </div>
                    {statusFilter === fKey && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />}
                  </button>
                );
              })}
            </div>
          </section>

          <button
            onClick={() => setIsFilterOpen(false)}
            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20"
          >
            Применить
          </button>
        </div>
      </BottomSheet>

      {links && links.length > 0 && (
        <div>
          <button onClick={() => setShowLinks(v => !v)} className="flex items-center gap-3 w-full px-2 py-1 group">
            <div className="flex items-center gap-2 flex-1">
              <ExternalLink size={15} className="text-orange-500 shrink-0" />
              <span className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Материалы</span>
              <span className="text-zinc-600 text-xs font-medium bg-white/5 px-2 py-0.5 rounded-full">{links.length}</span>
            </div>
            <ChevronRight size={16} className={`text-zinc-600 transition-transform ${showLinks ? 'rotate-90' : ''}`} />
          </button>
          {showLinks && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-orange-500/20 rounded-2xl transition-all group">
                  <div className="w-10 h-10 bg-orange-500/10 group-hover:bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                    {link.url.includes('docs.google.com/presentation') ? <FileText size={16} className="text-orange-500" /> : link.url.includes('/folders/') ? <Folder size={16} className="text-orange-500" /> : <ExternalLink size={16} className="text-orange-500" />}
                  </div>
                  <p className="text-white text-sm font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1 line-clamp-2">{link.title}</p>
                  <ChevronRight size={16} className="text-zinc-600 group-hover:text-orange-500 shrink-0 transition-colors" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <VideoGrid
        videos={paginated}
        loading={loading}
        activeVideo={null}
        onPlay={v => navigate(`/watch/${v.id}`, { state: { video: v } })}
      />
      <Pagination page={page} totalPages={displayTotalPages} onPageChange={setPage} />
    </div>
  );
};
