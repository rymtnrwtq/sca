import React from 'react';
import { Play, ChevronRight, ExternalLink, Dumbbell } from 'lucide-react';
import { CatalogItem } from '../../constants';

export const CatalogGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="animate-pulse bg-zinc-900/80 border border-white/[0.04] rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="w-11 h-11 bg-zinc-800 rounded-xl shrink-0" />
          <div className="w-16 h-6 bg-zinc-800 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-zinc-800 rounded-lg w-full" />
          <div className="h-4 bg-zinc-800 rounded-lg w-4/5" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 bg-zinc-800/60 rounded-lg w-full" />
          <div className="h-3 bg-zinc-800/60 rounded-lg w-3/4" />
        </div>
        <div className="h-4 bg-zinc-800/40 rounded-lg w-24 mt-auto" />
      </div>
    ))}
  </div>
);

export const CatalogGrid = ({
  items,
  onOpen,
}: {
  items: CatalogItem[];
  onOpen: (item: CatalogItem) => void;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 items-stretch">
    {items.map((item, idx) => (
      <button
        key={item.id ?? item.title ?? idx}
        onClick={() => onOpen(item)}
        className="bg-gradient-to-br from-zinc-900 to-zinc-900/80 border border-white/[0.06] rounded-2xl p-4 sm:p-6 text-left hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 group relative overflow-hidden flex flex-col h-full"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/[0.03] group-hover:to-orange-500/[0.08] transition-all duration-500" />
        <div className="relative flex flex-col h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="w-11 h-11 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
              {item.trainingPlanId
                ? <Dumbbell size={18} className="text-orange-500" />
                : item.externalUrl && !item.videoIds && !item.id
                  ? <ExternalLink size={18} className="text-orange-500" />
                  : <Play size={18} className="text-orange-500 ml-0.5" />}
            </div>
            {item.videoCount !== undefined && (
              <span className="shrink-0 text-xs font-semibold text-zinc-400 bg-white/[0.06] px-3 py-1 rounded-full">
                {item.videoCount} видео
              </span>
            )}
          </div>
          <h3 className="text-white font-bold text-base leading-snug group-hover:text-orange-400 transition-colors mb-2">
            {item.title}
          </h3>
          <p className="text-zinc-500 text-sm leading-relaxed line-clamp-3 mb-5 flex-1">{item.description}</p>
          <div className="flex items-center gap-2 text-orange-500 text-sm font-semibold group-hover:gap-3 transition-all mt-auto">
            {item.trainingPlanId ? 'Открыть' : item.externalUrl && !item.videoIds && !item.id ? 'Открыть' : 'Смотреть'} <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </button>
    ))}
  </div>
);
