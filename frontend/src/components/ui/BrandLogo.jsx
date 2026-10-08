import React from 'react';
import { Link } from 'react-router-dom';

export const BrandLogo = ({ size = 'md', showText = true, to = '/', className = '' }) => {
  const sizeMap = {
    sm: { icon: 28, text: 'text-lg', dot: 6 },
    md: { icon: 36, text: 'text-xl', dot: 8 },
    lg: { icon: 48, text: 'text-2xl', dot: 10 },
    xl: { icon: 64, text: 'text-3xl', dot: 12 },
  };

  const s = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`inline-flex items-center gap-2.5 font-bold tracking-tight select-none ${className}`}>
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        <defs>
          <linearGradient id="fc-g-logo" x1="0.1" y1="0.2" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#A3E635" />
          </linearGradient>
          <linearGradient id="fc-bg-dark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0B1220" />
            <stop offset="100%" stopColor="#052E1F" />
          </linearGradient>
          <filter id="fc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="512" height="512" rx="116" fill="url(#fc-bg-dark)" />
        <path
          d="M362 150A150 150 0 1 0 362 362"
          fill="none"
          stroke="url(#fc-g-logo)"
          strokeWidth="44"
          strokeLinecap="round"
          filter="url(#fc-glow)"
        />
        <g transform="rotate(28 256 253)">
          <path
            d="M256 336C196 306 190 224 256 170C322 224 316 306 256 336Z"
            fill="url(#fc-g-logo)"
          />
          <path d="M256 322V222" stroke="#052E1F" strokeWidth="12" strokeLinecap="round" />
        </g>
        <circle cx="406" cy="256" r="24" fill="#A3E635" className="animate-pulse" filter="url(#fc-glow)" />
        <circle cx="406" cy="256" r="12" fill="#FFFFFF" opacity="0.8" />
      </svg>
      {showText && (
        <span className={`${s.text} font-extrabold tracking-tight text-white dark:text-white`}>
          Food<span className="text-gradient">Cal</span>
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="group inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
};

export default BrandLogo;

