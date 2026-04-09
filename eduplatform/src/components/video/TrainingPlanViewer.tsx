import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Dumbbell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrainingPlan, TrainingSection } from '../../data/trainingPlans';

// Extract "Тренировка N" number and optional quoted title
function parseTrainingHeader(raw: string): { num: string; subtitle: string } {
  const m = raw.match(/^Тренировка\s+(\d{1,2})\s*(?:[«"""](.+?)[»"""])?/);
  return {
    num: m?.[1] ?? '',
    subtitle: m?.[2]?.trim() ?? '',
  };
}

// Format the body text (everything after the header) into readable lines
function formatBody(raw: string): string {
  // Strip "Тренировка N «...»" header
  let text = raw.replace(/^Тренировка\s+\d{1,2}\s*(?:[«"""].+?[»"""])?\s*/, '').trim();

  // Insert newline before common exercise-start patterns:
  // - "NxM" / "N*M" / "N×M"
  text = text.replace(/(?<=[а-яА-Яa-zA-Z\d.,)!])\s+(\d+\s*[x*×]\s*[\d(])/g, '\n$1');
  // - 3-4 digit distance followed by a space + letter
  text = text.replace(/(?<=[а-яА-Яa-zA-Z\d.,)!])\s+(\d{3,4}(?:м)?\s+[А-ЯA-Zа-яa-z])/g, '\n$1');
  // - "Итого:" always on its own line
  text = text.replace(/(?<!\n)(Итого:)/g, '\n$1');
  // Collapse 3+ newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// ── Training card ─────────────────────────────────────────────────────────────
const TrainingCard: React.FC<{ raw: string; globalNum: number }> = ({ raw, globalNum }) => {
  const [open, setOpen] = useState(false);
  const { num, subtitle } = parseTrainingHeader(raw);
  const displayNum = num || String(globalNum);
  const body = formatBody(raw);

  // Split body into lines for rendering
  const lines = body.split('\n');

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden transition-colors hover:border-white/10">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left group"
      >
        <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
          <span className="text-orange-500 text-xs font-bold leading-none">{displayNum}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-white font-semibold text-sm">
            Тренировка {displayNum}
          </span>
          {subtitle && (
            <span className="text-zinc-400 text-sm ml-1.5">«{subtitle}»</span>
          )}
        </div>
        {open
          ? <ChevronDown size={15} className="text-zinc-600 shrink-0" />
          : <ChevronRight size={15} className="text-zinc-600 shrink-0" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-white/[0.05] space-y-1.5">
              {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-1" />;

                // "Итого: X м" — highlighted summary line
                if (trimmed.startsWith('Итого:')) {
                  return (
                    <div key={i} className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-2">
                      <span className="text-orange-500/70 text-xs font-semibold uppercase tracking-wide">
                        {trimmed}
                      </span>
                    </div>
                  );
                }

                return (
                  <p key={i} className="text-zinc-300 text-sm leading-relaxed">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Section block ─────────────────────────────────────────────────────────────
const SectionBlock: React.FC<{ section: TrainingSection; startIndex: number }> = ({
  section,
  startIndex,
}) => {
  const [open, setOpen] = useState(true);
  if (!section.trainings.length) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 py-2 mb-3 group"
      >
        <span className="text-white font-bold text-base flex-1 text-left group-hover:text-orange-400 transition-colors">
          {section.title}
        </span>
        <span className="text-zinc-600 text-xs font-medium bg-white/[0.05] px-2.5 py-0.5 rounded-full shrink-0">
          {section.trainings.length} тр.
        </span>
        {open
          ? <ChevronDown size={15} className="text-zinc-600 shrink-0" />
          : <ChevronRight size={15} className="text-zinc-600 shrink-0" />}
      </button>

      {section.description && (
        <p className="text-zinc-500 text-sm leading-relaxed mb-3 -mt-1">
          {section.description}
        </p>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {section.trainings.map((t, i) => (
                <TrainingCard key={i} raw={t} globalNum={startIndex + i + 1} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main viewer ───────────────────────────────────────────────────────────────
export const TrainingPlanViewer: React.FC<{
  plan: TrainingPlan;
  onBack: () => void;
}> = ({ plan, onBack }) => {
  const totalCount = plan.sections.reduce((s, sec) => s + sec.trainings.length, 0);
  let globalIdx = 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-orange-500 hover:text-orange-400 text-sm font-semibold transition-colors"
        >
          <ChevronRight size={18} className="rotate-180" /> Назад к материалам
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center shrink-0">
            <Dumbbell size={22} className="text-orange-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">{plan.title}</h2>
            <p className="text-zinc-500 text-sm mt-1">{totalCount} тренировок</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {plan.sections.map((section, i) => {
          const start = globalIdx;
          globalIdx += section.trainings.length;
          return <SectionBlock key={i} section={section} startIndex={start} />;
        })}
      </div>
    </div>
  );
};
