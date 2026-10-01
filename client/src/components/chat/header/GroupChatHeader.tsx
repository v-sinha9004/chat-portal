import React from 'react';
import type { Group, GroupPresence } from '@/types';

interface GroupChatHeaderProps {
  group: Group;
  activeGroupPresence: GroupPresence | null;
  isTyping: boolean;
  typingText: string | null;
}

export const GroupChatHeader: React.FC<GroupChatHeaderProps> = ({
  group,
  activeGroupPresence,
  isTyping,
  typingText,
}) => {
  return (
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
          {isTyping && typingText && (
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
  );
};
