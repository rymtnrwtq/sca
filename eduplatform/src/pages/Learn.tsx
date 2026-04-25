import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, SlidersHorizontal, Bookmark, EyeOff, ChevronUp, ChevronDown, X, Radio, Play, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { Lesson } from '../types';
import {
  getWatchProgress,
  isInWatchLater,
  loadHiddenVideos,
  loadLearnPrefs,
  saveLearnPrefs
} from '../utils/localStorage';
import {
  TABS,
  SECTION_META,
  SORT_OPTIONS,
  CatalogItem,
  SortKey,
  SortDir,
  StatusFilter,
} from '../constants';
import { VideoGrid } from '../components/video/VideoGrid';
import { Pagination } from '../components/ui/Pagination';
import { BottomSheet } from '../components/ui/BottomSheet';
import { CatalogGrid, CatalogGridSkeleton } from '../components/video/CatalogGrid';
import { FolderViewer } from '../components/video/FolderViewer';
import { VideoPlaylistViewer } from '../components/video/VideoPlaylistViewer';
import { JsonSeminarsViewer } from '../components/video/JsonSeminarsViewer';
import { TrainingPlanViewer } from '../components/video/TrainingPlanViewer';
import { SeminarLinksViewer } from '../components/video/SeminarLinksViewer';
import { KinescopeBrowser } from '../components/video/KinescopeBrowser';
import { TRAINING_PLANS } from '../data/trainingPlans';

interface LiveBroadcast {
  active: boolean;
  embed_url?: string;
  event_id?: string | null;
}

interface DbCatalogItem {
  id: string;
  category_id: string;
  kinescope_folder_id: string | null;
  kinescope_project_id: string | null;
  video_ids: string[] | null;
  external_url: string | null;
  links: { title: string; url: string }[] | null;
  title: string;
  description: string;
  video_count: number;
  sort_order: number;
}

interface DbCatalogCategory {
  id: string;
  section: string;
  category_key: string;
  label: string;
  sort_order: number;
  items: DbCatalogItem[];
}

function dbItemToCatalogItem(item: DbCatalogItem): CatalogItem {
  return {
    id: item.kinescope_folder_id ?? undefined,
    projectId: item.kinescope_project_id ?? undefined,
    videoIds: item.video_ids ?? undefined,
    externalUrl: item.external_url ?? undefined,
    links: item.links ?? undefined,
    title: item.title,
    description: item.description,
    videoCount: item.video_count || undefined,
  };
}

export const Learn = () => {
  const navigate = useNavigate();
  const prefs = loadLearnPrefs();
  const [activeTab, setActiveTab] = useState<string>(prefs.activeTab ?? 'broadcasts');

  // Live broadcast state
  const [liveBroadcast, setLiveBroadcast] = useState<LiveBroadcast>({ active: false });
  const [liveLoading, setLiveLoading] = useState(false);

  // Latest broadcast (shown in materials tab)
  const [latestBroadcast, setLatestBroadcast] = useState<Lesson | null>(null);

  // Broadcasts state
  const [broadcastVideos, setBroadcastVideos] = useState<Lesson[]>([]);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastPage, setBroadcastPage] = useState(1);
  const [broadcastSort, setBroadcastSort] = useState<SortKey>(prefs.broadcastSort ?? 'date');
  const [broadcastSortDir, setBroadcastSortDir] = useState<SortDir>(prefs.broadcastSortDir ?? 'desc');
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Lesson[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [broadcastStatusFilter, setBroadcastStatusFilter] = useState<StatusFilter>('all');
  const [isBroadcastFilterOpen, setIsBroadcastFilterOpen] = useState(false);
  const [, forceUpdate] = useState(0);

  // Catalog from DB
  const [seminarCategories, setSeminarCategories] = useState<DbCatalogCategory[]>([]);
  const [materialCategories, setMaterialCategories] = useState<DbCatalogCategory[]>([]);

  useEffect(() => {
    fetch('/api/catalog?section=seminars')
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => setSeminarCategories(d.categories || []));
    fetch('/api/catalog?section=materials')
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => setMaterialCategories(d.categories || []));
  }, []);

  // Load the single latest broadcast for the materials tab header
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/broadcasts-json');
        if (!r.ok) return;
        const data: { videos: Array<{ video_id: string; video_url: string; title: string; description: string }> } = await r.json();
        if (!data.videos.length) return;
        const first = data.videos[0];
        const basic: Lesson = {
          id: first.video_id,
          title: first.title || first.video_id,
          description: first.description,
          embedUrl: first.video_url,
          duration: '—',
          durationSec: 0,
          posterUrl: null,
          chapters: [],
        };
        setLatestBroadcast(basic);
        // Enrich with poster + duration
        const r2 = await fetch(`/api/videos/by-ids?ids=${first.video_id}`);
        if (r2.ok) {
          const meta: { videos: Lesson[] } = await r2.json();
          if (meta.videos[0]) setLatestBroadcast({ ...basic, ...meta.videos[0] });
        }
      } catch {}
    };
    load();
  }, []);

  // Sync with global history/watch later updates
  useEffect(() => {
    const update = () => forceUpdate(v => v + 1);
    window.addEventListener('sca_history_update', update);
    window.addEventListener('sca_watch_later_update', update);
    return () => {
      window.removeEventListener('sca_history_update', update);
      window.removeEventListener('sca_watch_later_update', update);
    };
  }, []);

  // Load live broadcast (on mount + when tab active)
  const loadLiveBroadcast = () => {
    setLiveLoading(true);
    fetch('/api/live-broadcast')
      .then(r => r.ok ? r.json() : { active: false })
      .then(d => setLiveBroadcast(d))
      .finally(() => setLiveLoading(false));
  };

  useEffect(() => { loadLiveBroadcast(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'live') loadLiveBroadcast(); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // If live tab is selected but broadcast is off, redirect to broadcasts
  useEffect(() => {
    if (!liveLoading && activeTab === 'live' && !liveBroadcast.active) {
      setActiveTab('broadcasts');
    }
  }, [liveLoading, liveBroadcast.active, activeTab]);

  // Seminars sub-navigation
  const [seminarSubTab, setSeminarSubTab] = useState<string>(prefs.seminarSubTab ?? 'sca');
  const [openFolder, setOpenFolder] = useState<CatalogItem | null>(prefs.openFolder ?? null);

  // Global search effect
  useEffect(() => {
    if (!globalSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const r = await fetch(`/api/json-search?q=${encodeURIComponent(globalSearch)}`);
        const data: { videos: Lesson[] } = r.ok ? await r.json() : { videos: [] };
        setSearchResults(data.videos);

        // Enrich with Kinescope metadata (poster + duration)
        const ids = data.videos.map(v => v.id).filter(Boolean);
        if (ids.length > 0) {
          const r2 = await fetch(`/api/videos/by-ids?ids=${ids.join(',')}`);
          if (r2.ok) {
            const meta: { videos: Lesson[] } = await r2.json();
            const kMap = new Map(meta.videos.map(v => [v.id, v]));
            setSearchResults(prev => prev.map(v => {
              const km = kMap.get(v.id);
              if (!km) return v;
              return { ...v, posterUrl: km.posterUrl, duration: km.duration, durationSec: km.durationSec };
            }));
          }
        }
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  // Materials category + folder
  const [materialCategory, setMaterialCategory] = useState<string>(prefs.materialCategory ?? 'technique');
  const [openMaterialFolder, setOpenMaterialFolder] = useState<CatalogItem | null>(prefs.openMaterialFolder ?? null);

  // Persist preferences
  useEffect(() => { saveLearnPrefs({ activeTab }); }, [activeTab]);
  useEffect(() => { saveLearnPrefs({ broadcastSort, broadcastSortDir }); }, [broadcastSort, broadcastSortDir]);
  useEffect(() => { saveLearnPrefs({ seminarSubTab }); }, [seminarSubTab]);
  useEffect(() => { saveLearnPrefs({ materialCategory }); }, [materialCategory]);
  useEffect(() => { saveLearnPrefs({ openFolder }); }, [openFolder]);
  useEffect(() => { saveLearnPrefs({ openMaterialFolder }); }, [openMaterialFolder]);

  useEffect(() => {
    if (activeTab !== 'broadcasts') return;
    setBroadcastLoading(true);

    const load = async () => {
      try {
        const r = await fetch('/api/broadcasts-json');
        if (!r.ok) return;
        const data: { videos: Array<{ video_id: string; video_url: string; title: string; description: string }> } = await r.json();
        const jsonVideos = data.videos;

        const basicLessons: Lesson[] = jsonVideos.map(v => ({
          id: v.video_id,
          title: v.title || v.video_id,
          description: v.description,
          embedUrl: v.video_url,
          duration: '—',
          durationSec: 0,
          posterUrl: null,
          chapters: [],
        }));
        setBroadcastVideos(basicLessons);

        const ids = jsonVideos.map(v => v.video_id).filter(Boolean);
        if (ids.length > 0) {
          try {
            const r2 = await fetch(`/api/videos/by-ids?ids=${ids.join(',')}`);
            if (r2.ok) {
              const meta: { videos: Lesson[] } = await r2.json();
              const kMap = new Map(meta.videos.map(v => [v.id, v]));
              setBroadcastVideos(prev => prev.map(v => {
                const km = kMap.get(v.id);
                if (!km) return v;
                return { ...v, posterUrl: km.posterUrl, duration: km.duration, durationSec: km.durationSec, createdAt: km.createdAt };
              }));
            }
          } catch {}
        }
      } finally {
        setBroadcastLoading(false);
      }
    };

    load();
  }, [activeTab]);

  const handleBroadcastSort = (key: SortKey) => {
    if (broadcastSort === key) setBroadcastSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setBroadcastSort(key); setBroadcastSortDir(key === 'title' ? 'asc' : 'desc'); }
  };

  const filteredBroadcasts = broadcastVideos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(broadcastSearch.toLowerCase());
    const { progress } = getWatchProgress(v.id);
    const isPinned = isInWatchLater(v.id);
    const isHidden = loadHiddenVideos().includes(v.id);
    
    if (broadcastStatusFilter === 'hidden') return isHidden && matchesSearch;
    if (isHidden) return false;

    if (broadcastStatusFilter === 'progress') return matchesSearch && progress > 0 && progress < 95;
    if (broadcastStatusFilter === 'completed') return matchesSearch && progress >= 95;
    if (broadcastStatusFilter === 'pinned') return matchesSearch && isPinned;
    return matchesSearch;
  });

  const sortedBroadcasts = [...filteredBroadcasts].sort((a, b) => {
    let cmp = 0;
    if (broadcastSort === 'date')     cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    if (broadcastSort === 'duration') cmp = (a.durationSec ?? 0) - (b.durationSec ?? 0);
    if (broadcastSort === 'title')    cmp = a.title.localeCompare(b.title, 'ru');
    return broadcastSortDir === 'asc' ? cmp : -cmp;
  });

  const PAGE_SIZE = 24;
  const totalFiltered = sortedBroadcasts.length;
  const displayTotalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const paginatedBroadcasts = sortedBroadcasts.slice((broadcastPage - 1) * PAGE_SIZE, broadcastPage * PAGE_SIZE);

  const activeSeminarCat = seminarCategories.find(c => c.category_key === seminarSubTab) || seminarCategories[0];
  const rawSeminarItems: CatalogItem[] = (activeSeminarCat?.items || []).map(dbItemToCatalogItem);

  const activeMaterialCat = materialCategories.find(c => c.category_key === materialCategory) || materialCategories[0];
  const materialItems: CatalogItem[] = (activeMaterialCat?.items || []).map(dbItemToCatalogItem);

  const searchedSeminars = rawSeminarItems.filter(item =>
    item.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
    item.description.toLowerCase().includes(globalSearch.toLowerCase())
  );

  const searchedMaterials = materialItems.filter(item =>
    item.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
    item.description.toLowerCase().includes(globalSearch.toLowerCase())
  );

  const handleTabChange = (tab: string) => {
    if (tab === 'live') { navigate('/live'); return; }
    setActiveTab(tab);
    setOpenFolder(null);
    setOpenMaterialFolder(null);
    setGlobalSearch('');
    setSearchResults([]);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-28 md:pb-8 overflow-x-hidden">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Обучение</h1>
            <p className="text-zinc-500 mt-1 text-sm md:text-base">Семинары, эфиры и материалы</p>
          </div>
          <div className="relative group w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Поиск по всем видео..."
              value={globalSearch}
              onChange={e => {
                setGlobalSearch(e.target.value);
                if (activeTab === 'broadcasts') setBroadcastPage(1);
              }}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-3 md:py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 transition-all"
            />
            {globalSearch && (
              <button
                onClick={() => { setGlobalSearch(''); setSearchResults([]); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {TABS.filter(tab => tab !== 'live' || liveBroadcast.active).map(tab => {
            const isLiveTab = tab === 'live';
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "px-5 py-3 md:px-6 md:py-3.5 rounded-2xl text-sm md:text-base font-bold transition-all whitespace-nowrap flex items-center gap-2",
                  activeTab === tab
                    ? isLiveTab
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                      : "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : isLiveTab
                      ? "bg-zinc-900 text-red-400 hover:bg-zinc-800 border border-red-500/20"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
              >
                {isLiveTab && <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse shrink-0" />}
                {SECTION_META[tab].label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'live' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          {liveLoading ? (
            <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          ) : !liveBroadcast.active ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-zinc-900 rounded-[28px] flex items-center justify-center mx-auto">
                <Radio size={32} className="text-zinc-700" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Эфира нет</p>
                <p className="text-zinc-600 text-sm mt-1">Когда начнётся трансляция — она появится здесь</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate('/live')}
              className="group relative w-full max-w-2xl bg-gradient-to-br from-red-950/60 to-zinc-900 border border-red-500/30 rounded-3xl p-10 text-center hover:border-red-500/60 hover:shadow-2xl hover:shadow-red-500/20 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 group-hover:from-red-500/[0.07] transition-all duration-500" />
              <div className="relative space-y-6">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm font-black uppercase tracking-widest">Прямой эфир</span>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                </div>
                <div className="w-24 h-24 bg-red-500/15 rounded-full flex items-center justify-center mx-auto group-hover:bg-red-500/25 transition-colors">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-500/40 group-hover:scale-110 transition-transform">
                    <Radio size={28} className="text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-white font-black text-2xl">Присоединиться к эфиру</p>
                  <p className="text-zinc-500 text-sm mt-2">Откроется плеер и чат трансляции</p>
                </div>
              </div>
            </button>
          )}
        </div>
      )}

      {activeTab === 'broadcasts' && (
        globalSearch ? (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white px-1">Результаты поиска</h3>
            <VideoGrid 
              videos={searchResults} 
              loading={isSearching} 
              activeVideo={null}
              onPlay={v => navigate(`/watch/${v.id}`, { state: { video: v } })} 
            />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 w-full lg:w-auto">
                <button
                  onClick={() => setIsBroadcastFilterOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl text-sm font-bold text-white hover:bg-zinc-800 transition-all shrink-0"
                >
                  <SlidersHorizontal size={18} className="text-orange-500" />
                  Фильтры
                  {(broadcastStatusFilter !== 'all' || broadcastSort !== 'date') && (
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
              </div>
            </div>

            <BottomSheet
              isOpen={isBroadcastFilterOpen}
              onClose={() => setIsBroadcastFilterOpen(false)}
              title="Фильтры и сортировка"
            >
              <div className="space-y-8">
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Статус</h4>
                    {(broadcastStatusFilter !== 'all' || broadcastSort !== 'date') && (
                      <button 
                        onClick={() => {
                          setBroadcastStatusFilter('all');
                          setBroadcastSort('date');
                          setBroadcastSortDir('desc');
                          setBroadcastPage(1);
                        }}
                        className="text-orange-500 text-[10px] font-bold uppercase tracking-wider hover:underline"
                      >
                        Сбросить
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
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
                          onClick={() => { setBroadcastStatusFilter(fKey); setBroadcastPage(1); }}
                          className={cn(
                            "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all border text-left flex justify-between items-center",
                            broadcastStatusFilter === fKey
                              ? "bg-orange-500/10 border-orange-500/50 text-white"
                              : "bg-white/5 border-white/5 text-zinc-400"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {Icon && <Icon size={14} className={broadcastStatusFilter === fKey ? "text-orange-500" : "text-zinc-600"} />}
                            {labels[fKey]}
                          </div>
                          {broadcastStatusFilter === fKey && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />}
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
                        onClick={() => handleBroadcastSort(o.key)}
                        className={cn(
                          "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all border text-left flex justify-between items-center",
                          broadcastSort === o.key
                            ? "bg-orange-500/10 border-orange-500/50 text-white"
                            : "bg-white/5 border-white/5 text-zinc-400"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {o.icon} {o.label}
                        </div>
                        {broadcastSort === o.key && (
                          <div className="flex items-center gap-2">
                             {broadcastSortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                             <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>

                <button
                  onClick={() => setIsBroadcastFilterOpen(false)}
                  className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20"
                >
                  Применить
                </button>
              </div>
            </BottomSheet>

            <VideoGrid
              videos={paginatedBroadcasts}
              loading={broadcastLoading}
              activeVideo={null}
              onPlay={v => navigate(`/watch/${v.id}`, { state: { video: v, allVideos: broadcastVideos } })}
            />
            {displayTotalPages > 1 && (
              <Pagination 
                page={broadcastPage} 
                totalPages={displayTotalPages} 
                onPageChange={setBroadcastPage} 
              />
            )}
          </div>
        )
      )}

      {(activeTab === 'seminars' || activeTab === 'materials') && globalSearch && (
        <div className="space-y-8">
          {activeTab === 'seminars' && (
            <>
              {seminarCategories.some(cat => cat.items.some(item =>
                item.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
                item.description.toLowerCase().includes(globalSearch.toLowerCase())
              )) && (
                <section>
                  <h3 className="text-xl font-bold text-white px-1 mb-4">Каталоги</h3>
                  <div className="space-y-6">
                    {seminarCategories.map(cat => {
                      const items = cat.items.filter(item =>
                        item.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
                        item.description.toLowerCase().includes(globalSearch.toLowerCase())
                      ).map(dbItemToCatalogItem);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat.category_key} className="space-y-3">
                          <h4 className="text-sm font-bold text-zinc-500 px-1 uppercase tracking-wider">{cat.label}</h4>
                          <CatalogGrid items={items} onOpen={setOpenFolder} />
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'materials' && (
            <>
              {materialCategories.some(cat => cat.items.some(item =>
                item.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
                item.description.toLowerCase().includes(globalSearch.toLowerCase())
              )) && (
                <section>
                  <h3 className="text-xl font-bold text-white px-1 mb-4">Каталоги</h3>
                  <div className="space-y-6">
                    {materialCategories.map(cat => {
                      const items = cat.items.filter(item =>
                        item.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
                        item.description.toLowerCase().includes(globalSearch.toLowerCase())
                      ).map(dbItemToCatalogItem);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat.category_key} className="space-y-3">
                          <h4 className="text-sm font-bold text-zinc-500 px-1 uppercase tracking-wider">{cat.label}</h4>
                          <CatalogGrid items={items} onOpen={setOpenMaterialFolder} />
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          <section>
            <h3 className="text-xl font-bold text-white px-1 mb-4">Видео</h3>
            <VideoGrid 
              videos={searchResults} 
              loading={isSearching} 
              activeVideo={null}
              onPlay={v => navigate(`/watch/${v.id}`, { state: { video: v } })} 
            />
          </section>
        </div>
      )}

      {activeTab === 'seminars' && !globalSearch && (
        <JsonSeminarsViewer />
      )}

      {activeTab === 'materials' && !globalSearch && (
        <div className="space-y-6">
          {latestBroadcast && (
            <div className="space-y-3">
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                <Radio size={12} className="text-orange-500" /> Последний эфир
              </h2>
              <button
                onClick={() => navigate(`/watch/${latestBroadcast.id}`, { state: { video: latestBroadcast } })}
                className="group w-full relative bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden hover:border-orange-500/30 transition-all duration-300 text-left"
              >
                {latestBroadcast.posterUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden">
                    <img
                      src={latestBroadcast.posterUrl}
                      alt={latestBroadcast.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 bg-black/50 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center group-hover:bg-orange-500/80 group-hover:border-orange-500 transition-all duration-300">
                        <Play size={22} className="text-white ml-1" fill="currentColor" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-bold text-base leading-snug line-clamp-2">{latestBroadcast.title}</p>
                      {latestBroadcast.duration && latestBroadcast.duration !== '—' && (
                        <p className="text-zinc-400 text-xs mt-1 flex items-center gap-1">
                          <Clock size={11} /> {latestBroadcast.duration}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
                      <Play size={20} className="text-orange-500 ml-0.5" fill="currentColor" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{latestBroadcast.title}</p>
                      {latestBroadcast.duration && latestBroadcast.duration !== '—' && (
                        <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                          <Clock size={11} /> {latestBroadcast.duration}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-zinc-600 group-hover:text-orange-500 transition-colors">
                      <Play size={18} />
                    </div>
                  </div>
                )}
              </button>
            </div>
          )}
          <KinescopeBrowser />
        </div>
      )}
    </motion.div>
  );
};
