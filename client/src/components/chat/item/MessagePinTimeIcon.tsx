import React from 'react';

interface MessagePinTimeIconProps {
  size?: number;
  className?: string;
}

export const MessagePinTimeIcon: React.FC<MessagePinTimeIconProps> = ({
  size = 10,
  className = 'message-time-pin-icon',
}) => {
  return (
    <span className={className} title="Pinned message" aria-label="Pinned message">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
      >
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
      </svg>
    </span>
  );
};
