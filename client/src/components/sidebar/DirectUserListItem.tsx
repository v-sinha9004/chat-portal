import React from 'react';
import type { User } from '@/types';
import { getInitials, getRoleBadgeClass } from '@/utils';

interface DirectUserListItemProps {
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
    <div
      className={`user-item ${isSelected ? 'active' : ''} ${
        hasUnread ? 'has-unread' : ''
      }`}
      onClick={() => onSelect(contact)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(contact);
        }
      }}
    >
      <div className="avatar-wrapper">
        {contact.avatarUrl ? (
          <img src={contact.avatarUrl} alt={contact.name} className="avatar-img" />
        ) : (
          <div className={`avatar-placeholder avatar-${contact.role.toLowerCase()}`}>
            {getInitials(contact.name)}
          </div>
        )}
      </div>

      <div className="user-info">
        <div className="user-info-top">
          <span className="user-name">{contact.name}</span>
          <span className={getRoleBadgeClass(contact.role)}>{contact.role}</span>
        </div>
        <div className="user-username-row">
          <span className="user-username">@{contact.username}</span>
          {unreadCount > 0 ? (
            <span
              className="unread-badge"
              title={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : hasUnread ? (
            <span className="unread-dot" title="New direct message" />
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
        ) : contact.bio ? (
          <p className="user-bio">{contact.bio}</p>
        ) : (
          <p className="user-email">{contact.email}</p>
        )}
      </div>
    </div>
  );
};
