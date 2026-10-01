import React from 'react';

interface SidebarStatusProps {
  isLoading: boolean;
  error: string | null;
  totalConversations: number;
  onRetry: () => void;
}

export const SidebarStatus: React.FC<SidebarStatusProps> = ({
  isLoading,
  error,
  totalConversations,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="user-skeletons" aria-label="Loading conversations">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton-user-item">
            <div className="skeleton-avatar" />
            <div className="skeleton-info">
              <div className="skeleton-line skeleton-name" />
              <div className="skeleton-line skeleton-username" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-list-error">
        <div className="error-icon">⚠️</div>
        <p className="error-message">{error}</p>
        <button type="button" className="retry-btn" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }

  if (totalConversations === 0) {
    return (
      <div className="user-list-empty">
        <p>No conversations yet</p>
        <span className="user-list-empty-sub">
          Click <strong>+</strong> above to create a group or wait for contacts to appear.
        </span>
      </div>
    );
  }

  return null;
};
