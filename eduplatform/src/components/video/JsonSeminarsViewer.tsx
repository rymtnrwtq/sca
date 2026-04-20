import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Play, Download, ExternalLink, X, SlidersHorizontal, ChevronUp, ChevronDown, Bookmark, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BottomSheet } from '../ui/BottomSheet';
import { getWatchProgress, isInWatchLater, loadHiddenVideos } from '../../utils/localStorage';
import { SORT_OPTIONS, SortKey, SortDir, StatusFilter } from '../../constants';
import { Lesson, DownloadItem } from '../../types';
import { cn } from '../../lib/utils';
import { VideoGrid } from './VideoGrid';
import { Pagination } from '../ui/Pagination';

// ---------- Types ---------------------------------------------------------

interface JsonVideo {
  video_id: string;
  video_url: string;
  title: string;
  description: string;
}

interface JsonSeminar {
  id: string;
  title: string;
  description: string;
  video_count: number;
  videos: JsonVideo[];
  downloads: DownloadItem[];
  broadcast_url?: string | null;
}

interface JsonCategory {
  key: string;
  title: string;
  seminars: JsonSeminar[];
}

interface SeminarsJsonResponse {
  categories: JsonCategory[];
  orphans: JsonSeminar[];
}

// ---------- Helpers -------------------------------------------------------

function jsonVideoToLesson(v: JsonVideo, kMeta?: any): Lesson {
  return {
    id: v.video_id,
    title: v.title || kMeta?.title || v.video_id,
    description: v.description,
    embedUrl: v.video_url || kMeta?.embedUrl || `https://kinescope.io/embed/${v.video_id}`,
    posterUrl: kMeta?.posterUrl ?? null,
    duration: kMeta?.duration ?? '—',
    durationSec: kMeta?.durationSec ?? 0,
    chapters: kMeta?.chapters ?? [],
  };
}

// Fetch Kinescope metadata for a batch of video IDs
async function fetchKinescopeMeta(ids: string[]): Promise<Record<string, any>> {
  if (!ids.length) return {};
  try {
    const r = await fetch(`/api/videos/by-ids?ids=${ids.join(',')}`);
    if (!r.ok) return {};
    const data: { videos: any[] } = await r.json();
    const map: Record<string, any> = {};
    for (const v of data.videos) map[v.id] = v;
    return map;
  } catch {
    return {};
  }
}

// ---------- Broadcast modal ------------------------------------------------

export const BroadcastModal: React.FC<{ embedUrl: string; eventId: string | null; title: string; onClose: () => void }> = ({ embedUrl, eventId, title, onClose }) => {
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [chatTab, setChatTab] = useState(false); // mobile: toggle between video/chat

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!eventId) return;
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch(`/api/live-chat-token?event_id=${encodeURIComponent(eventId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.token) setChatUrl(`https://kinescope.io/chat/${eventId}?token=${d.token}`);
          else if (eventId) setChatUrl(`https://kinescope.io/chat/${eventId}`);
        })
        .catch(() => { if (eventId) setChatUrl(`https://kinescope.io/chat/${eventId}`); });
    } else if (eventId) {
      setChatUrl(`https://kinescope.io/chat/${eventId}`);
    }
  }, [eventId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/80 backdrop-blur shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
          <span className="text-white font-bold text-sm truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {/* Mobile tab toggle */}
          {chatUrl && (
            <div className="flex md:hidden bg-zinc-900 border border-white/10 rounded-xl p-0.5">
              <button
                onClick={() => setChatTab(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!chatTab ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
              >
                Эфир
              </button>
              <button
                onClick={() => setChatTab(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chatTab ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
              >
                Чат
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Player */}
        <div className={`relative ${chatUrl ? 'hidden md:block md:flex-1' : 'flex-1'} ${!chatTab ? 'flex flex-col' : 'hidden'} md:flex`}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
          />
        </div>

        {/* Chat */}
        {chatUrl && (
          <div className={`${chatTab ? 'flex flex-col flex-1' : 'hidden'} md:flex md:w-80 lg:w-96 md:border-l md:border-white/5 relative shrink-0`}>
            <iframe
              src={chatUrl}
              className="absolute inset-0 w-full h-full"
              allow="autoplay"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Download item component ----------------------------------------

const DownloadCard: React.FC<{ item: DownloadItem }> = ({ item }) => (
  <a
    href={item.url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-3 p-4 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-orange-500/20 rounded-2xl transition-all group"
  >
    <div className="w-10 h-10 bg-orange-500/10 group-hover:bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0 transition-colors">
      {item.type === 'google_drive' ? (
        <ExternalLink size={16} className="text-orange-500" />
      ) : (
        <Download size={16} className="text-orange-500" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-sm font-semibold leading-snug group-hover:text-orange-400 transition-colors line-clamp-2">
        {item.title}
      </p>
      <p className="text-zinc-600 text-xs mt-0.5">
        {item.type === 'google_drive' ? 'Google Drive' : 'Скачать файл'}
      </p>
    </div>
    <ChevronRight size={16} className="text-zinc-600 group-hover:text-orange-500 shrink-0 transition-colors" />
  </a>
);

// ---------- Seminar Card component ------------------------------------------

const SeminarCard: React.FC<{ seminar: JsonSeminar; onOpen: (s: JsonSeminar) => void }> = ({
  seminar,
  onOpen,
}) => (
  <button
    onClick={() => onOpen(seminar)}
    className="bg-gradient-to-br from-zinc-900 to-zinc-900/80 border border-white/[0.06] rounded-2xl p-6 text-left hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 group relative overflow-hidden flex flex-col h-full"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/[0.03] group-hover:to-orange-500/[0.08] transition-all duration-500" />
    <div className="relative flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-11 h-11 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
          <Play size={18} className="text-orange-500 ml-0.5" />
        </div>
        <span className="shrink-0 text-xs font-semibold text-zinc-400 bg-white/[0.06] px-3 py-1 rounded-full">
          {seminar.video_count} видео
        </span>
      </div>
      <h3 className="text-white font-bold text-base leading-snug group-hover:text-orange-400 transition-colors mb-2">
        {seminar.title}
      </h3>
      <p className="text-zinc-500 text-sm leading-relaxed line-clamp-3 mb-5 flex-1">
        {seminar.description}
      </p>
      <div className="flex items-center gap-2 text-orange-500 text-sm font-semibold group-hover:gap-3 transition-all mt-auto">
        Смотреть <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  </button>
);

// ---------- Seminar Detail view ---------------------------------------------

const SeminarDetail = ({
  seminar,
  onBack,
}: {
  seminar: JsonSeminar;
  onBack: () => void;
}) => {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showDownloads, setShowDownloads] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [, forceUpdate] = useState(0);
  const PAGE_SIZE = 24;

  useEffect(() => {
    setLoading(true);
    setPage(1);
    const videoIds = seminar.videos.map(v => v.video_id).filter(Boolean);
    fetchKinescopeMeta(videoIds).then(kMap => {
      const merged = seminar.videos.map(v => jsonVideoToLesson(v, kMap[v.video_id]));
      setLessons(merged);
      setLoading(false);
    });
  }, [seminar.id]);

  useEffect(() => {
    const update = () => forceUpdate(v => v + 1);
    window.addEventListener('sca_history_update', update);
    window.addEventListener('sca_watch_later_update', update);
    return () => {
      window.removeEventListener('sca_history_update', update);
      window.removeEventListener('sca_watch_later_update', update);
    };
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'title' ? 'asc' : 'asc'); }
  };

  const filteredLessons = lessons.filter(v => {
    const { progress } = getWatchProgress(v.id);
    const isPinned = isInWatchLater(v.id);
    const isHidden = loadHiddenVideos().includes(v.id);
    if (statusFilter === 'hidden') return isHidden;
    if (isHidden) return false;
    if (statusFilter === 'progress') return progress > 0 && progress < 95;
    if (statusFilter === 'completed') return progress >= 95;
    if (statusFilter === 'pinned') return isPinned;
    return true;
  });

  const sortedLessons = [...filteredLessons].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'date') cmp = 0; // preserve original order by default
    if (sortKey === 'duration') cmp = (a.durationSec ?? 0) - (b.durationSec ?? 0);
    if (sortKey === 'title') cmp = a.title.localeCompare(b.title, 'ru');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedLessons.length / PAGE_SIZE));
  const paginated = sortedLessons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = statusFilter !== 'all' || sortKey !== 'date';

  const handlePlay = useCallback((v: Lesson) => {
    const fullLesson: Lesson = { ...v, downloads: seminar.downloads, seminarTitle: seminar.title };
    navigate(`/watch/${v.id}`, {
      state: {
        video: fullLesson,
        downloads: seminar.downloads,
        seminarTitle: seminar.title,
        allVideos: sortedLessons.map(l => ({ ...l, downloads: seminar.downloads, seminarTitle: seminar.title })),
      },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navigate, seminar, sortedLessons]);

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-orange-500 hover:text-orange-400 text-sm font-semibold transition-colors"
        >
          <ChevronRight size={18} className="rotate-180" /> Назад к семинарам
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white leading-tight">{seminar.title}</h2>
          {seminar.description && (
            <p className="text-zinc-500 text-sm mt-2 leading-relaxed max-w-3xl">{seminar.description}</p>
          )}
        </div>
      </div>

      {/* Materials / downloads */}
      {seminar.downloads.length > 0 && (
        <div>
          <button
            onClick={() => setShowDownloads(v => !v)}
            className="flex items-center gap-3 w-full px-2 py-1 group"
          >
            <div className="flex items-center gap-2 flex-1">
              <Download size={15} className="text-orange-500 shrink-0" />
              <span className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Материалы</span>
              <span className="text-zinc-600 text-xs font-medium bg-white/5 px-2 py-0.5 rounded-full">
                {seminar.downloads.length}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {seminar.downloads.map((dl, i) => (
                    <DownloadCard key={i} item={dl} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Filter button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsFilterOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl text-sm font-bold text-white hover:bg-zinc-800 transition-all shrink-0"
        >
          <SlidersHorizontal size={18} className="text-orange-500" />
          Фильтры
          {hasActiveFilters && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
        </button>
      </div>

      {/* BottomSheet */}
      <BottomSheet isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="Фильтры и сортировка">
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Статус</h4>
              {hasActiveFilters && (
                <button
                  onClick={() => { setStatusFilter('all'); setSortKey('date'); setSortDir('asc'); setPage(1); }}
                  className="text-orange-500 text-[10px] font-bold uppercase tracking-wider hover:underline"
                >
                  Сбросить
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(['all', 'progress', 'completed', 'pinned', 'hidden'] as StatusFilter[]).map(fKey => {
                const labels: Record<string, string> = {
                  all: 'Все', progress: 'В процессе', completed: 'Завершенные',
                  pinned: 'Избранное', hidden: 'Скрытые',
                };
                const Icon = fKey === 'hidden' ? EyeOff : fKey === 'pinned' ? Bookmark : undefined;
                return (
                  <button
                    key={fKey}
                    onClick={() => { setStatusFilter(fKey); setPage(1); }}
                    className={cn(
                      "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all border text-left flex justify-between items-center",
                      statusFilter === fKey
                        ? "bg-orange-500/10 border-orange-500/50 text-white"
                        : "bg-white/5 border-white/5 text-zinc-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {Icon && <Icon size={14} className={statusFilter === fKey ? "text-orange-500" : "text-zinc-600"} />}
                      {labels[fKey]}
                    </div>
                    {statusFilter === fKey && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Сортировка</h4>
            <div className="space-y-2">
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.key}
                  onClick={() => handleSort(o.key)}
                  className={cn(
                    "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all border text-left flex justify-between items-center",
                    sortKey === o.key
                      ? "bg-orange-500/10 border-orange-500/50 text-white"
                      : "bg-white/5 border-white/5 text-zinc-400"
                  )}
                >
                  <div className="flex items-center gap-3">{o.icon} {o.label}</div>
                  {sortKey === o.key && (
                    <div className="flex items-center gap-2">
                      {sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                    </div>
                  )}
                </button>
              ))}
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

      {/* Video grid */}
      <VideoGrid videos={paginated} loading={loading} activeVideo={null} onPlay={handlePlay} />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
};

// ---------- Main component --------------------------------------------------

export const JsonSeminarsViewer = () => {
  const [data, setData] = useState<SeminarsJsonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('sca');
  const [selectedSeminar, setSelectedSeminar] = useState<JsonSeminar | null>(null);

  useEffect(() => {
    fetch('/api/seminars-json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  const handleBack = () => setSelectedSeminar(null);

  const handleTabChange = (key: string) => {
    setActiveCategory(key);
    setSelectedSeminar(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-zinc-500">
        Не удалось загрузить данные семинаров
      </div>
    );
  }

  if (selectedSeminar) {
    return <SeminarDetail seminar={selectedSeminar} onBack={handleBack} />;
  }

  const activeCategory_ = data.categories.find(c => c.key === activeCategory) ?? data.categories[0];
  const seminars = activeCategory_?.seminars ?? [];

  return (
    <div className="space-y-5">
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {data.categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => handleTabChange(cat.key)}
            className={cn(
              'shrink-0 whitespace-nowrap px-5 py-3 rounded-2xl text-sm md:text-base font-semibold transition-all',
              activeCategory === cat.key
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            )}
          >
            {cat.title}
          </button>
        ))}
      </div>

      {/* Seminar cards */}
      {seminars.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">Семинары не найдены</div>
      ) : (
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
         {seminars.map(s => (
           <SeminarCard key={s.id} seminar={s} onOpen={setSelectedSeminar} />
         ))}
       </div>
      )}    </div>
  );
};
