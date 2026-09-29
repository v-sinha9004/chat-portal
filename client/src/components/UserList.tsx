import React from 'react';
import type { User } from '../types';

interface UserListProps {
  users: User[];
  currentUserId: string | null;
  onSwitchCurrentUser: (userId: string) => void;
  selectedUserId: string | null;
  onSelectUser: (user: User) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isSocketConnected: boolean;
  unreadUserIds?: Set<string>;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  currentUserId,
  onSwitchCurrentUser,
  selectedUserId,
  onSelectUser,
  isLoading = false,
  error = null,
  onRetry,
  isSocketConnected,
  unreadUserIds = new Set(),
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return 'role-badge badge-admin';
      case 'MENTOR':
        return 'role-badge badge-mentor';
      case 'MENTEE':
        return 'role-badge badge-mentee';
      default:
        return 'role-badge';
    }
  };

  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const contacts = users.filter((u) => u.id !== currentUserId);

  return (
    <aside className="sidebar">
      {/* Current User Identity / Switcher */}
      <div className="current-user-card">
        <div className="current-user-header">
          <span className="current-user-label">Logged in as</span>
          <span
            className={`socket-status-badge ${isSocketConnected ? 'connected' : 'disconnected'}`}
            title={isSocketConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
          >
            <span className="socket-dot" />
            {isSocketConnected ? 'Connected' : 'Offline'}
          </span>
        </div>

        {users.length > 0 && (
          <div className="current-user-selector-wrapper">
            <select
              className="current-user-select"
              value={currentUserId || ''}
              onChange={(e) => onSwitchCurrentUser(e.target.value)}
              aria-label="Switch active user"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {currentUser && (
          <div className="current-user-info-row">
            <div className="current-user-avatar">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} />
              ) : (
                <div className={`avatar-placeholder avatar-${currentUser.role.toLowerCase()}`}>
                  {getInitials(currentUser.name)}
                </div>
              )}
            </div>
            <div className="current-user-details">
              <span className="current-user-name">{currentUser.name}</span>
              <span className="current-user-email">@{currentUser.username}</span>
            </div>
          </div>
        )}
      </div>

      {/* Contacts List Header */}
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <h2>Contacts</h2>
          <span className="user-count-badge">
            {isLoading ? '...' : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`}
          </span>
        </div>
        <p className="sidebar-subtitle">
          {isLoading ? 'Fetching contacts from server...' : 'Select a contact to direct message'}
        </p>
      </div>

      <div className="user-list">
        {isLoading && (
          <div className="user-skeletons" aria-label="Loading contacts">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton-user-item">
                <div className="skeleton-avatar" />
                <div className="skeleton-info">
                  <div className="skeleton-line skeleton-name" />
                  <div className="skeleton-line skeleton-username" />
                  <div className="skeleton-line skeleton-bio" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="user-list-error">
            <div className="error-icon">⚠️</div>
            <p className="error-message">{error}</p>
            {onRetry && (
              <button type="button" className="retry-btn" onClick={onRetry}>
                Try Again
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && contacts.length === 0 && (
          <div className="user-list-empty">
            <p>No other contacts available</p>
          </div>
        )}

        {!isLoading &&
          !error &&
          contacts.map((user) => {
            const isSelected = user.id === selectedUserId;
            const hasUnread = unreadUserIds.has(user.id);

            return (
              <div
                key={user.id}
                className={`user-item ${isSelected ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                onClick={() => onSelectUser(user)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectUser(user);
                  }
                }}
              >
                <div className="avatar-wrapper">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="avatar-img" />
                  ) : (
                    <div className={`avatar-placeholder avatar-${user.role.toLowerCase()}`}>
                      {getInitials(user.name)}
                    </div>
                  )}
                  {user.isActive && <span className="status-indicator online" title="Active" />}
                </div>

                <div className="user-info">
                  <div className="user-info-top">
                    <span className="user-name">{user.name}</span>
                    <span className={getRoleBadgeClass(user.role)}>{user.role}</span>
                  </div>
                  <div className="user-username-row">
                    <span className="user-username">@{user.username}</span>
                    {hasUnread && <span className="unread-dot" title="New message" />}
                  </div>
                  {user.bio ? (
                    <p className="user-bio">{user.bio}</p>
                  ) : (
                    <p className="user-email">{user.email}</p>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
};
