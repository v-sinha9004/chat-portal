import React from 'react';

interface ReplyIconProps {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number | string;
  title?: string;
}

export const ReplyIcon: React.FC<ReplyIconProps> = ({
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
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
};
