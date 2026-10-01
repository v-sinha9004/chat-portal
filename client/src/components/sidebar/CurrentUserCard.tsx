import React, { useState, useRef, useEffect } from 'react';
import type { User, AuthUser } from '@/types';
import { getInitials, getRoleBadgeClass } from '@/utils';

interface CurrentUserCardProps {
  user: User | AuthUser | null;
  isSocketConnected: boolean;
  onLogout: () => void;
  onCreateGroup?: () => void;
}

export const CurrentUserCard: React.FC<CurrentUserCardProps> = ({
  user,
  isSocketConnected,
  onLogout,
  onCreateGroup,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

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

          <div className="sidebar-action-wrapper" ref={menuRef}>
            <button
              type="button"
              className="action-add-btn current-user-menu-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="More options"
              aria-label="More options"
              aria-expanded={isMenuOpen}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>

            {isMenuOpen && (
              <div className="action-dropdown-menu">
                {onCreateGroup && (
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onCreateGroup();
                    }}
                  >
                    <span className="dropdown-item-icon">👥</span>
                    <div className="dropdown-item-text">
                      <span className="dropdown-item-title">New Group</span>
                      <span className="dropdown-item-desc">Create a group chat</span>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  className="dropdown-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                >
                  <span className="dropdown-item-icon">🚪</span>
                  <div className="dropdown-item-text">
                    <span className="dropdown-item-title">Sign Out</span>
                    <span className="dropdown-item-desc">Log out of your account</span>
                  </div>
                </button>
              </div>
            )}
          </div>
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
