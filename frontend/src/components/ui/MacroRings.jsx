import React from 'react';
import { motion } from 'framer-motion';

export const MacroRings = ({
  protein = 0,
  carbs = 0,
  fat = 0,
  targetProtein = 120,
  targetCarbs = 200,
  targetFat = 60,
  className = '',
}) => {
  const macros = [
    {
      name: 'Protein',
      current: Math.round(protein),
      target: targetProtein || 120,
      unit: 'g',
      color: '#F43F5E',
      bgColor: 'rgba(244, 63, 94, 0.12)',
      labelColor: 'text-rose-400',
    },
    {
      name: 'Carbs',
      current: Math.round(carbs),
      target: targetCarbs || 200,
      unit: 'g',
      color: '#F59E0B',
      bgColor: 'rgba(245, 158, 11, 0.12)',
      labelColor: 'text-amber-400',
    },
    {
      name: 'Fat',
      current: Math.round(fat),
      target: targetFat || 60,
      unit: 'g',
      color: '#38BDF8',
      bgColor: 'rgba(56, 189, 248, 0.12)',
      labelColor: 'text-sky-400',
    },
  ];

  return (
    <div className={`grid grid-cols-3 gap-3 w-full ${className}`}>
      {macros.map((m) => {
        const pct = Math.min(100, Math.round((m.current / m.target) * 100)) || 0;
        return (
          <div
            key={m.name}
            className="flex flex-col p-3 rounded-2xl border border-dark-border/60 bg-dark-surface/80"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-bold ${m.labelColor}`}>{m.name}</span>
              <span className="text-[10px] text-dark-muted font-medium">{pct}%</span>
            </div>

            {/* Progress track */}
            <div
              className="h-2 w-full rounded-full overflow-hidden my-1 relative"
              style={{ backgroundColor: m.bgColor }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: m.color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            <div className="flex items-baseline justify-between mt-1 text-[11px]">
              <span className="font-bold text-dark-text">{m.current}{m.unit}</span>
              <span className="text-dark-muted">/ {m.target}{m.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MacroRings;

