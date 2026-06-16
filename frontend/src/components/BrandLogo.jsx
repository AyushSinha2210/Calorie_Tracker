import React from "react";

const BrandLogo = ({ compact = false, className = "" }) => {
  const textSize = compact ? "text-sm" : "text-base";
  const iconSize = compact ? "w-8 h-8" : "w-10 h-10";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`.trim()} aria-label="FoodCalo">
      <svg className={iconSize} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="foodcalo-gradient" x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22C55E" />
            <stop offset="1" stopColor="#16A34A" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill="url(#foodcalo-gradient)" />
        <circle cx="20" cy="20" r="12" fill="white" fillOpacity="0.14" />
        <path d="M12.5 20c0-4.14 3.36-7.5 7.5-7.5 1.76 0 3.37.61 4.65 1.63L16.17 25.6A7.47 7.47 0 0 1 12.5 20Z" fill="#F8FAFC" fillOpacity="0.95" />
        <path d="M27.5 20c0 4.14-3.36 7.5-7.5 7.5-1.76 0-3.37-.61-4.65-1.63l8.98-11.97A7.47 7.47 0 0 1 27.5 20Z" fill="#DCFCE7" />
        <path d="M25.7 10.8c1.86.04 3.73.68 5.15 1.88-1.84 2.12-4.42 3.08-7.05 3.13.15-2.65 1.01-4.66 1.9-5.01Z" fill="#052E16" fillOpacity="0.45" />
      </svg>
      {!compact && <span className={`font-extrabold tracking-tight text-surface-900 dark:text-surface-100 ${textSize}`}>FoodCalo</span>}
    </div>
  );
};

export default BrandLogo;