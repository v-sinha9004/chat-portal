import React from 'react';
import type { User, AuthUser } from '@/types';
import { getInitials, getRoleBadgeClass } from '@/utils';

interface CurrentUserCardProps {
  user: User | AuthUser | null;
  isSocketConnected: boolean;
  onLogout: () => void;
}

export const CurrentUserCard: React.FC<CurrentUserCardProps> = ({
  user,
  isSocketConnected,
  onLogout,
}) => {
  return (
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
          <button
            type="button"
            className="current-user-logout-btn"
            onClick={onLogout}
            title="Sign out of your session"
          >
            Sign out
          </button>
        </div>
      </div>

      {user && (
        <div className="current-user-info-row">
          <div className="current-user-avatar">
            {'avatarUrl' in user && typeof user.avatarUrl === 'string' ? (
              <img src={user.avatarUrl} alt={user.name || 'User'} />
            ) : (
              <div
                className={`avatar-placeholder avatar-${(user.role || 'mentee').toLowerCase()}`}
              >
                {getInitials(user.name || user.email)}
              </div>
            )}
          </div>
          <div className="current-user-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="current-user-name">{user.name || user.email}</span>
              <span className={getRoleBadgeClass(user.role)}>{user.role}</span>
            </div>
            <span className="current-user-email">
              {user.username ? `@${user.username}` : user.email}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
