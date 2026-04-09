import React from 'react';

export const Pagination = ({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
        className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white rounded-xl text-sm font-semibold transition-colors min-w-[100px]">
        Назад
      </button>
      <span className="text-zinc-400 text-sm font-medium tabular-nums">{page} / {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
        className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white rounded-xl text-sm font-semibold transition-colors min-w-[100px]">
        Далее
      </button>
    </div>
  );
};
