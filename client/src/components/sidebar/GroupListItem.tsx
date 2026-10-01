import React from 'react';
import type { Group } from '@/types';
import { ChatListItem } from './ChatListItem';

export interface GroupListItemProps {
  group: Group;
  isSelected: boolean;
  hasUnread: boolean;
  unreadCount: number;
  isTyping: boolean;
  onSelect: (group: Group) => void;
}

export const GroupListItem: React.FC<GroupListItemProps> = ({
  group,
  isSelected,
  hasUnread,
  unreadCount,
  isTyping,
  onSelect,
}) => {
  return (
    <ChatListItem
      item={{ type: 'group', group }}
      isSelected={isSelected}
      hasUnread={hasUnread}
      unreadCount={unreadCount}
      isTyping={isTyping}
      onSelect={(convo) => {
        if (convo.type === 'group') {
          onSelect(convo.group);
        }
      }}
    />
  );
};

