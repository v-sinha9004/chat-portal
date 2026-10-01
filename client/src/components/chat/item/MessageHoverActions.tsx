import React from 'react';
import type { ChatMessage } from '@/types';

interface MessageHoverActionsProps {
  message: ChatMessage;
  isPinned: boolean;
  canManagePins: boolean;
  onPinMessage: (message: ChatMessage) => Promise<void>;
  onUnpinMessage: (message: ChatMessage) => Promise<void>;
  onInitiateReply: (message: ChatMessage) => void;
}

export const MessageHoverActions: React.FC<MessageHoverActionsProps> = ({
  message,
  isPinned,
  canManagePins,
  onPinMessage,
  onUnpinMessage,
  onInitiateReply,
}) => {
  return (
    <>
      {/* Hover Pin Action Button */}
      {canManagePins && (
        <button
          type="button"
          className={`message-pin-btn ${isPinned ? 'pinned' : ''}`}
          onClick={() => (isPinned ? onUnpinMessage(message) : onPinMessage(message))}
          title={isPinned ? 'Unpin message' : 'Pin message'}
          aria-label={isPinned ? 'Unpin message' : 'Pin message'}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={isPinned ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </button>
      )}

      {/* Hover Reply Action Button */}
      <button
        type="button"
        className="message-reply-btn"
        onClick={() => onInitiateReply(message)}
        title="Reply"
        aria-label="Reply to message"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 17 4 12 9 7" />
          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
        </svg>
      </button>
    </>
  );
};
