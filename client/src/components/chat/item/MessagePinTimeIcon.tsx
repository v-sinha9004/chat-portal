import React from 'react';
import { PinIcon } from '@/components/icons';

interface MessagePinTimeIconProps {
  size?: number;
  className?: string;
}

export const MessagePinTimeIcon: React.FC<MessagePinTimeIconProps> = ({
  size = 11,
  className = 'message-time-pin-icon',
}) => {
  return (
    <span className={className} title="Pinned message" aria-label="Pinned message">
      <PinIcon size={size} filled={true} />
    </span>
  );
};
