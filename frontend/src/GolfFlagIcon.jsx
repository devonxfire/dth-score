// https://heroicons.com/ - Heroicons v2.0.18 MIT License
// This is a simple golf flag SVG React component for use in modals
import React from 'react';

export default function GolfFlagIcon({ className = '', style = {}, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      style={style}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 21V3m0 0l9 4.5L6 12M18 21a1 1 0 11-2 0 1 1 0 012 0z"
      />
    </svg>
  );
}
