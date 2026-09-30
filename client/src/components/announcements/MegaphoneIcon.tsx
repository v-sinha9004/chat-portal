import React from 'react';

interface MegaphoneIconProps {
  size?: number;
  className?: string;
  color?: string;
}

export const MegaphoneIcon: React.FC<MegaphoneIconProps> = ({
  size = 18,
  className = '',
  color = '#ffffff',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20.5 5.2c0-.7-.6-1.2-1.3-1L15.4 6H4.5C3.7 6 3 6.7 3 7.5v4c0 .8.7 1.5 1.5 1.5h2.8l1.4 6.8c.2.9 1 1.5 1.9 1.4.9-.2 1.5-1 1.4-1.9L11 13.5l8.2 1.8c.7.2 1.3-.3 1.3-1V5.2z"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
