import React from 'react';
import type { ChatMessage } from '../../types';
import { MegaphoneIcon } from './MegaphoneIcon';

interface AnnouncementCardProps {
  message: ChatMessage;
  senderDisplayName?: string;
  isMe: boolean;
  onReply?: (message: ChatMessage) => void;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  message,
  senderDisplayName,
  isMe,
  onReply,
}) => {
  return (
    <div
      id={`msg-${message.id}`}
      className={`message-row announcement-row ${isMe ? 'sent' : 'received'}`}
      data-message-id={message.id}
    >
      <div className="message-bubble-wrapper">
        <div className="announcement-card">
        {/* Top Accent Header Banner */}
        <div className="announcement-header-banner">
          <div className="announcement-badge-row">
            <span className="announcement-icon" aria-hidden="true">
              <MegaphoneIcon size={17} color="#ffffff" />
            </span>
            <span className="announcement-label">ANNOUNCEMENT</span>
          </div>

          <h4 className="announcement-headline">{message.heading || 'Announcement'}</h4>
        </div>

        {/* Announcement Message Body */}
        <div className="announcement-body">
          <p className="announcement-text">{message.text}</p>
        </div>

        {/* Card Footer: Sender Meta & Timestamp */}
        <div className="announcement-footer">
          <div className="announcement-author-info">
            {senderDisplayName && (
              <span className="announcement-sender-name">{senderDisplayName}</span>
            )}
            <span className="role-badge badge-mentor announcement-role-tag">MENTOR</span>
          </div>

          <div className="announcement-meta-right">
            <span className="announcement-timestamp">{message.timestamp}</span>
            {isMe && message.status && (
              <span
                className={`message-status status-${message.status}`}
                title={`Status: ${message.status.charAt(0).toUpperCase() + message.status.slice(1)}`}
              >
                {message.status === 'sending' && '⏱'}
                {message.status === 'sent' && '✓'}
                {message.status === 'delivered' && '✓✓'}
                {message.status === 'read' && '✓✓'}
                {message.status === 'failed' && '⚠️'}
              </span>
            )}
          </div>
        </div>
      </div>
      {onReply && (
        <button
          type="button"
          className="message-reply-btn"
          onClick={() => onReply(message)}
          title="Reply"
          aria-label="Reply to announcement"
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
      )}
    </div>
  </div>
  );
};
