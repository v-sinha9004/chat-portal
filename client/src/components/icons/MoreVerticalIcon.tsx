import React from 'react';

interface MoreVerticalIconProps {
  size?: number;
  className?: string;
  color?: string;
  title?: string;
}

export const MoreVerticalIcon: React.FC<MoreVerticalIconProps> = ({
  size = 18,
  className = '',
  color = 'currentColor',
  title,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="1" fill={color} />
      <circle cx="12" cy="5" r="1" fill={color} />
      <circle cx="12" cy="19" r="1" fill={color} />
    </svg>
  );
};
