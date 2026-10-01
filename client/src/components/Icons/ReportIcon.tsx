import React from 'react';

interface ReportIconProps {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number | string;
  title?: string;
}

export const ReportIcon: React.FC<ReportIconProps> = ({
  size = 15,
  className = '',
  color = 'currentColor',
  strokeWidth = 2.2,
  title,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
};
