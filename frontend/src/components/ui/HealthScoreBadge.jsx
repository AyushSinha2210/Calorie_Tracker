import React from 'react';

export const HealthScoreBadge = ({ score = 0, size = 'sm', showLabel = true }) => {
  const num = Number(score) || 0;
  if (!num) return null;

  let color = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  let label = 'Low';
  if (num >= 8) {
    color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    label = 'Clean';
  } else if (num >= 6) {
    color = 'text-lime-400 bg-lime-500/10 border-lime-500/20';
    label = 'Balanced';
  } else if (num >= 4) {
    color = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    label = 'Moderate';
  }

  if (size === 'lg') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border font-semibold ${color}`}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-xs bg-white/10">
          {num}
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] uppercase tracking-wider opacity-80">Health Score</span>
          <span className="text-xs font-bold leading-none">{label} · {num}/10</span>
        </div>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold ${color}`}>
      <span>★ {num}/10</span>
      {showLabel && <span className="opacity-80 font-normal">({label})</span>}
    </span>
  );
};

export default HealthScoreBadge;

