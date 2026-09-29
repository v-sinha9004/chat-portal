import React from 'react';
import type { User, AuthUser } from '../types';

interface UserListProps {
  users: User[];
  currentUserId: string | null;
  currentUser?: User | AuthUser | null;
  onLogout?: () => void;
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
  currentUser: propCurrentUser,
  onLogout,
  selectedUserId,
  onSelectUser,
  isLoading = false,
  error = null,
  onRetry,
  isSocketConnected,
  unreadUserIds = new Set(),
}) => {
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeClass = (role?: string) => {
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

  // Find user in fetched contacts list or fallback to propCurrentUser
  const foundUser = users.find((u) => u.id === currentUserId);
  const activeUser = foundUser || propCurrentUser || null;
  const contacts = users.filter((u) => u.id !== currentUserId);

  return (
    <aside className="sidebar">
      {/* Current Logged-in User Identity Card */}
      <div className="current-user-card">
        <div className="current-user-header">
          <span className="current-user-label">My Account</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className={`socket-status-badge ${isSocketConnected ? 'connected' : 'disconnected'}`}
              title={isSocketConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
            >
              <span className="socket-dot" />
              {isSocketConnected ? 'Connected' : 'Offline'}
            </span>
            {onLogout && (
              <button
                type="button"
                className="current-user-logout-btn"
                onClick={onLogout}
                title="Sign out of your session"
              >
                Sign out
              </button>
            )}
          </div>
        </div>

        {activeUser && (
          <div className="current-user-info-row">
            <div className="current-user-avatar">
              {'avatarUrl' in activeUser && typeof activeUser.avatarUrl === 'string' ? (
                <img src={activeUser.avatarUrl} alt={activeUser.name || 'User'} />
              ) : (
                <div
                  className={`avatar-placeholder avatar-${(activeUser.role || 'mentee').toLowerCase()}`}
                >
                  {getInitials(activeUser.name || activeUser.email)}
                </div>
              )}
            </div>
            <div className="current-user-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="current-user-name">{activeUser.name || activeUser.email}</span>
                <span className={getRoleBadgeClass(activeUser.role)}>{activeUser.role}</span>
              </div>
              <span className="current-user-email">
                {activeUser.username ? `@${activeUser.username}` : activeUser.email}
              </span>
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
