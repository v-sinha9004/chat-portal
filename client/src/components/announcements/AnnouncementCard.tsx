import React from 'react';
import type { ChatMessage, AttachmentInfo } from '../../types';
import { MegaphoneIcon } from '../Icons';
import { AttachmentRenderer } from '../media/AttachmentRenderer';

interface AnnouncementCardProps {
  message: ChatMessage;
  senderDisplayName?: string;
  isMe: boolean;
  onReply?: (message: ChatMessage) => void;
  onQuoteClick?: (messageId: string) => void;
  getDisplayName?: (userId: string) => string;
  onPin?: (message: ChatMessage) => void;
  isPinned?: boolean;
  onOpenLightbox?: (attachment: AttachmentInfo) => void;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  message,
  senderDisplayName,
  isMe,
  onReply,
  onQuoteClick,
  getDisplayName,
  onPin,
  isPinned = false,
  onOpenLightbox,
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

        {/* Quoted Reply Card if Announcement is replying to a message */}
        {message.replyTo && (
          <div
            className="reply-quote-card announcement-quote-card"
            onClick={() => onQuoteClick?.(message.replyTo!.messageId)}
            role="button"
            tabIndex={0}
            title="Click to jump to quoted message"
          >
            <div className="reply-quote-bar" />
            <div className="reply-quote-body">
              <span className="reply-quote-sender">
                {getDisplayName ? getDisplayName(message.replyTo.senderId) : message.replyTo.senderId}
              </span>
              <p className="reply-quote-snippet">{message.replyTo.text}</p>
            </div>
          </div>
        )}

        {/* Announcement Message Body */}
        <div className="announcement-body">
          {message.attachments && message.attachments.length > 0 && (
            <AttachmentRenderer
              attachments={message.attachments}
              onOpenLightbox={onOpenLightbox}
              isSentByMe={isMe}
            />
          )}
          {message.text && <p className="announcement-text">{message.text}</p>}
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
      {onPin && (
        <button
          type="button"
          className={`message-pin-btn ${isPinned ? 'pinned' : ''}`}
          onClick={() => onPin(message)}
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

