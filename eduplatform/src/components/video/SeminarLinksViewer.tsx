import React from 'react';
import { ArrowLeft, ExternalLink, FileText, Folder } from 'lucide-react';
import { SeminarLink } from '../../constants';

function getLinkIcon(url: string) {
  if (url.includes('docs.google.com/presentation')) return <FileText size={18} className="text-orange-400 shrink-0" />;
  if (url.includes('drive.google.com/drive/folders')) return <Folder size={18} className="text-orange-400 shrink-0" />;
  return <ExternalLink size={18} className="text-orange-400 shrink-0" />;
}

export const SeminarLinksViewer = ({
  title,
  description,
  links,
  onBack,
}: {
  title: string;
  description: string;
  links: SeminarLink[];
  onBack: () => void;
}) => (
  <div className="space-y-5">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold"
      >
        <ArrowLeft size={18} /> Назад
      </button>
    </div>

    <div>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {description && <p className="text-zinc-500 text-sm mt-1">{description}</p>}
    </div>

    <div className="space-y-3">
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 bg-zinc-900 border border-white/[0.06] rounded-2xl p-4 hover:border-orange-500/30 hover:bg-zinc-800/60 transition-all group"
        >
          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
            {getLinkIcon(link.url)}
          </div>
          <span className="text-white text-sm font-medium leading-snug flex-1">{link.title}</span>
          <ExternalLink size={14} className="text-zinc-600 group-hover:text-orange-500 shrink-0 transition-colors" />
        </a>
      ))}
    </div>
  </div>
);
