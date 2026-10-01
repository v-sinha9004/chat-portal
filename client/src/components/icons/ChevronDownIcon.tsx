import React from 'react';

interface ChevronDownIconProps {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
  title?: string;
}

export const ChevronDownIcon: React.FC<ChevronDownIconProps> = ({
  size = 14,
  className = '',
  color = 'currentColor',
  strokeWidth = 2.5,
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
};
