import React from 'react';
import type { ChatMessage } from '@/types';

interface ReplyPreviewBarProps {
  replyingTo: ChatMessage;
  getDisplayName: (userId: string) => string;
  onCancel: () => void;
}

export const ReplyPreviewBar: React.FC<ReplyPreviewBarProps> = ({
  replyingTo,
  getDisplayName,
  onCancel,
}) => {
  return (
    <div className="replying-preview-bar">
      <div className="replying-preview-bar-indicator" />
      <div className="replying-preview-content">
        <span className="replying-preview-label">
          Replying to{' '}
          <strong className="replying-preview-author">
            {getDisplayName(replyingTo.senderId)}
          </strong>
        </span>
        <p className="replying-preview-text">{replyingTo.text}</p>
      </div>
      <button
        type="button"
        className="replying-preview-close-btn"
        onClick={onCancel}
        title="Cancel reply (Esc)"
        aria-label="Cancel reply"
      >
        ✕
      </button>
    </div>
  );
};
