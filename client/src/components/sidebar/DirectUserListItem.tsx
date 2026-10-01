import React from 'react';
import type { User } from '@/types';
import { ChatListItem } from './ChatListItem';

export interface DirectUserListItemProps {
  contact: User;
  isSelected: boolean;
  hasUnread: boolean;
  unreadCount: number;
  isTyping: boolean;
  onSelect: (user: User) => void;
}

export const DirectUserListItem: React.FC<DirectUserListItemProps> = ({
  contact,
  isSelected,
  hasUnread,
  unreadCount,
  isTyping,
  onSelect,
}) => {
  return (
    <ChatListItem
      item={{ type: 'direct', user: contact }}
      isSelected={isSelected}
      hasUnread={hasUnread}
      unreadCount={unreadCount}
      isTyping={isTyping}
      onSelect={(convo) => {
        if (convo.type === 'direct') {
          onSelect(convo.user);
        }
      }}
    />
  );
};

