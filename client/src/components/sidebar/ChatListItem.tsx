import React from 'react';
import type { User, Group, ActiveConversation } from '@/types';
import { getInitials, getRoleBadgeClass } from '@/utils';

export type ChatListItemData =
  | { type: 'direct'; user: User }
  | { type: 'group'; group: Group };

export interface ChatListItemProps {
  item: ChatListItemData;
  isSelected: boolean;
  hasUnread: boolean;
  unreadCount: number;
  isTyping: boolean;
  onSelect: (conversation: ActiveConversation) => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
  item,
  isSelected,
  hasUnread,
  unreadCount,
  isTyping,
  onSelect,
}) => {
  const isGroup = item.type === 'group';

  const handleClick = () => {
    if (isGroup) {
      onSelect({ type: 'group', id: item.group.id, group: item.group });
    } else {
      onSelect({ type: 'direct', id: item.user.id, user: item.user });
    }
  };

  const name = isGroup ? item.group.name : item.user.name;
  const avatarUrl = isGroup ? item.group.avatarUrl : item.user.avatarUrl;

  return (
    <div
      className={`user-item ${isGroup ? 'group-item' : ''} ${isSelected ? 'active' : ''} ${hasUnread ? 'has-unread' : ''
        }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={`avatar-wrapper ${isGroup ? 'group-avatar' : ''}`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="avatar-img" />
        ) : isGroup ? (
          <div className="avatar-placeholder avatar-group-bg">
            <span className="avatar-group-icon">👥</span>
          </div>
        ) : (
          <div className={`avatar-placeholder avatar-${item.user.role.toLowerCase()}`}>
            {getInitials(item.user.name)}
          </div>
        )}
      </div>

      <div className="user-info">
        <div className="user-info-top">
          <span className="user-name">{name}</span>
          <span className={getRoleBadgeClass(isGroup ? 'GROUP' : item.user.role)}>
            {isGroup ? 'Group' : item.user.role}
          </span>
        </div>

        <div className="user-username-row">
          <span className="user-username">
            {isGroup
              ? `${item.group.memberCount ?? 1} ${item.group.memberCount === 1 ? 'member' : 'members'
              }`
              : `@${item.user.username}`}
          </span>
          {unreadCount > 0 ? (
            <span
              className="unread-badge"
              title={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : hasUnread ? (
            <span
              className="unread-dot"
              title={isGroup ? 'New group message' : 'New direct message'}
            />
          ) : null}
        </div>

        {isTyping ? (
          <p className="user-typing-indicator-sidebar">
            <span className="typing-dots mini">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
            <span>typing...</span>
          </p>
        ) : isGroup ? (
          item.group.description ? (
            <p className="user-bio">{item.group.description}</p>
          ) : null
        ) : item.user.bio ? (
          <p className="user-bio">{item.user.bio}</p>
        ) : (
          null
        )}
      </div>
    </div>
  );
};
