import React from 'react';
import type { ActiveConversation, UserPresence, GroupPresence } from '../../types';
import { PinnedMessageCarousel } from '../pins/PinnedMessageCarousel';
import { formatLastSeen, getInitials } from '../../utils/formatters';

interface ChatHeaderProps {
  activeConversation: ActiveConversation;
  activePresence: UserPresence | null;
  activeGroupPresence: GroupPresence | null;
  isLoadingPresence: boolean;
  activeTypingUserIds: string[];
  typingText: string | null;
  canManagePins: boolean;
  onBack: () => void;
  onPinClick: (targetMessageId: string) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeConversation,
  activePresence,
  activeGroupPresence,
  isLoadingPresence,
  activeTypingUserIds,
  typingText,
  canManagePins,
  onBack,
  onPinClick,
}) => {
  const isGroup = activeConversation.type === 'group';
  const group = isGroup ? activeConversation.group : null;
  const directUser = !isGroup ? activeConversation.user : null;

  return (
    <>
      <header className="chat-header">
        <div className="chat-header-user">
          <button
            type="button"
            className="mobile-back-btn"
            onClick={onBack}
            aria-label="Back to conversations"
            title="Back to conversations"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          {isGroup && group ? (
            <>
              <div className="avatar-wrapper group-avatar">
                {group.avatarUrl ? (
                  <img src={group.avatarUrl} alt={group.name} className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder avatar-group-bg">
                    <span className="avatar-group-icon">👥</span>
                  </div>
                )}
              </div>

              <div className="chat-header-details">
                <div className="chat-header-name-row">
                  <h3>{group.name}</h3>
                  <span className="role-badge badge-group">Group</span>
                </div>
                <div className="chat-header-sub">
                  <span className="members-badge">
                    {group.memberCount ?? 1} {group.memberCount === 1 ? 'member' : 'members'}
                  </span>
                  {activeGroupPresence && (
                    <>
                      <span className="dot-separator">•</span>
                      <span className="group-online-badge">
                        <span className="presence-dot online mini" />
                        {activeGroupPresence.onlineCount} online
                      </span>
                    </>
                  )}
                  {activeTypingUserIds.length > 0 && (
                    <>
                      <span className="dot-separator">•</span>
                      <span className="group-typing-badge">{typingText}</span>
                    </>
                  )}
                  {group.description && (
                    <>
                      <span className="dot-separator">•</span>
                      <span className="group-desc-preview">{group.description}</span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : directUser ? (
            <>
              <div className="avatar-wrapper">
                {directUser.avatarUrl ? (
                  <img src={directUser.avatarUrl} alt={directUser.name} className="avatar-img" />
                ) : (
                  <div
                    className={`avatar-placeholder avatar-${(directUser.role || 'mentee').toLowerCase()}`}
                  >
                    {getInitials(directUser.name)}
                  </div>
                )}
                {activePresence?.isOnline && (
                  <span className="status-indicator online" title="Online" />
                )}
              </div>

              <div className="chat-header-details">
                <div className="chat-header-name-row">
                  <h3>{directUser.name}</h3>
                  <span
                    className={`role-badge badge-${(directUser.role || 'mentee').toLowerCase()}`}
                  >
                    {directUser.role}
                  </span>
                </div>
                <div className="chat-header-sub">
                  <span>@{directUser.username}</span>
                  <span className="dot-separator header-email-sep">•</span>
                  <span className="user-email-text">{directUser.email}</span>
                  <span className="dot-separator">•</span>
                  {activeTypingUserIds.length > 0 ? (
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
                {directUser.bio && <div className="chat-header-bio">"{directUser.bio}"</div>}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {/* Pinned Messages Carousel */}
      <PinnedMessageCarousel
        onPinClick={onPinClick}
        canManagePins={canManagePins}
      />
    </>
  );
};
