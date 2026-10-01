import React from 'react';

interface MessageListEmptyStateProps {
  isGroup: boolean;
  groupName?: string;
  directUserName?: string;
}

export const MessageListEmptyState: React.FC<MessageListEmptyStateProps> = ({
  isGroup,
  groupName,
  directUserName,
}) => {
  return (
    <div className="no-messages">
      <p>
        No messages yet in {isGroup && groupName ? `#${groupName}` : directUserName}.
      </p>
      <span className="no-messages-sub">Send a message below to start a live conversation!</span>
    </div>
  );
};
