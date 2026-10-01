import React from 'react';

interface UserPlusIconProps {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number | string;
  title?: string;
}

export const UserPlusIcon: React.FC<UserPlusIconProps> = ({
  size = 16,
  className = '',
  color = 'currentColor',
  strokeWidth = 2,
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
};
