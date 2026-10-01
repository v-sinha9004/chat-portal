import React from 'react';
import type { User, UserPresence } from '../../../types';
import { formatLastSeen, getInitials } from '../../../utils/formatters';

interface DirectChatHeaderProps {
  user: User;
  activePresence: UserPresence | null;
  isLoadingPresence: boolean;
  isTyping: boolean;
}

export const DirectChatHeader: React.FC<DirectChatHeaderProps> = ({
  user,
  activePresence,
  isLoadingPresence,
  isTyping,
}) => {
  return (
    <>
      <div className="avatar-wrapper">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="avatar-img" />
        ) : (
          <div className={`avatar-placeholder avatar-${(user.role || 'mentee').toLowerCase()}`}>
            {getInitials(user.name)}
          </div>
        )}
        {activePresence?.isOnline && (
          <span className="status-indicator online" title="Online" />
        )}
      </div>

      <div className="chat-header-details">
        <div className="chat-header-name-row">
          <h3>{user.name}</h3>
          <span className={`role-badge badge-${(user.role || 'mentee').toLowerCase()}`}>
            {user.role}
          </span>
        </div>
        <div className="chat-header-sub">
          <span>@{user.username}</span>
          <span className="dot-separator header-email-sep">•</span>
          <span className="user-email-text">{user.email}</span>
          <span className="dot-separator">•</span>
          {isTyping ? (
            <span className="status-text typing">
              <span className="presence-dot online mini" /> typing...
            </span>
          ) : isLoadingPresence ? (
            <span className="status-text loading">Checking...</span>
          ) : activePresence?.isOnline ? (
            <span className="status-text online">
              <span className="presence-dot online" /> Online
            </span>
          ) : (
            <span className="status-text offline">
              <span className="presence-dot offline" /> Offline{' '}
              {formatLastSeen(activePresence?.lastSeen)}
            </span>
          )}
        </div>
        {user.bio && <div className="chat-header-bio">"{user.bio}"</div>}
      </div>
    </>
  );
};
