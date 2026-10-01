import React from 'react';
import type { Group } from '@/types';
import { getRoleBadgeClass } from '@/utils';

interface GroupListItemProps {
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
    <div
      className={`user-item group-item ${isSelected ? 'active' : ''} ${
        hasUnread ? 'has-unread' : ''
      }`}
      onClick={() => onSelect(group)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(group);
        }
      }}
    >
      <div className="avatar-wrapper group-avatar">
        {group.avatarUrl ? (
          <img src={group.avatarUrl} alt={group.name} className="avatar-img" />
        ) : (
          <div className="avatar-placeholder avatar-group-bg">
            <span className="avatar-group-icon">👥</span>
          </div>
        )}
      </div>

      <div className="user-info">
        <div className="user-info-top">
          <span className="user-name">{group.name}</span>
          <span className={getRoleBadgeClass('GROUP')}>Group</span>
        </div>
        <div className="user-username-row">
          <span className="user-username">
            {group.memberCount ?? 1} {group.memberCount === 1 ? 'member' : 'members'}
          </span>
          {unreadCount > 0 ? (
            <span
              className="unread-badge"
              title={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : hasUnread ? (
            <span className="unread-dot" title="New group message" />
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
        ) : group.description ? (
          <p className="user-bio">{group.description}</p>
        ) : null}
      </div>
    </div>
  );
};
