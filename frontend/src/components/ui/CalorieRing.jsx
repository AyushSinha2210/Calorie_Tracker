import React from 'react';
import { motion } from 'framer-motion';

export const CalorieRing = ({
  consumed = 0,
  target = 2000,
  burned = 0,
  size = 220,
  strokeWidth = 16,
}) => {
  const effectiveTarget = target > 0 ? target : 2000;
  // Net calories = consumed - burned
  const remaining = Math.max(0, effectiveTarget - consumed + burned);
  const percent = Math.min(100, Math.round((consumed / effectiveTarget) * 100));

  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(1, consumed / effectiveTarget) * circumference);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#A3E635" />
            </linearGradient>
            <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
          />

          {/* Progress circle */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="url(#ringGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            strokeLinecap="round"
            style={{ filter: 'url(#ringGlow)' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-muted">
            {remaining > 0 ? 'Remaining' : 'Over Target'}
          </span>
          <motion.span
            className="text-4xl font-extrabold tracking-tight text-dark-text"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {remaining.toLocaleString()}
          </motion.span>
          <span className="text-xs font-medium text-dark-muted">
            kcal · {percent}%
          </span>
        </div>
      </div>

      {/* Triple stats below ring */}
      <div className="grid grid-cols-3 gap-6 mt-5 w-full max-w-xs text-center">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wider text-dark-muted">Goal</span>
          <span className="text-sm font-bold text-dark-text mt-0.5">{effectiveTarget}</span>
        </div>
        <div className="flex flex-col border-x border-dark-border/60">
          <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">Eaten</span>
          <span className="text-sm font-bold text-emerald-400 mt-0.5">{consumed}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wider text-orange-400">Burned</span>
          <span className="text-sm font-bold text-orange-400 mt-0.5">-{burned}</span>
        </div>
      </div>
    </div>
  );
};

export default CalorieRing;

