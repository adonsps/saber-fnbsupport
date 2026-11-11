import React from 'react';
import { cn } from '@/lib/utils';

interface SaberLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Official Saber Culinary Brand Mark
 * Combines the signature Saber dual-blade + electric cyan horizon geometry
 * with a subtle cloche dome silhouette inside a tactile squircle badge.
 */
export function SaberLogo({ className, size = 'md' }: SaberLogoProps) {
  const dimensions =
    size === 'sm'
      ? 'h-8 w-8 rounded-[10px]'
      : size === 'lg'
      ? 'h-11 w-11 rounded-[14px]'
      : 'h-9 w-9 rounded-[11px]';

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#0F1E36] shadow-apple-sm ring-1 ring-inset ring-white/15',
        dimensions,
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 164 152"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[74%] w-[74%]"
        aria-hidden="true"
      >
        {/* Subtle Culinary Cloche Handle Dot */}
        <circle cx="82" cy="15" r="6.5" fill="#0090FF" />
        {/* Top Saber Blade / Cloche Dome */}
        <path
          d="M 14 44 C 37 19, 127 19, 150 44 C 118 52, 46 52, 14 44 Z"
          fill="#FFFFFF"
        />
        {/* Middle Electric Cyan Horizon Pill */}
        <rect x="42" y="67" width="80" height="18" rx="9" fill="#0090FF" />
        {/* Bottom Saber Blade / Serving Platter Base */}
        <path
          d="M 14 108 C 46 100, 118 100, 150 108 C 127 133, 37 133, 14 108 Z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
}

