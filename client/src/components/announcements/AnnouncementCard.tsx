import React from 'react';
import type { ChatMessage, AttachmentInfo } from '@/types';
import { MegaphoneIcon, PinIcon } from '@/components/icons';
import { AttachmentRenderer } from '@/components/media';

interface AnnouncementCardProps {
  message: ChatMessage;
  senderDisplayName?: string;
  isMe: boolean;
  isPinned?: boolean;
  onQuoteClick?: (messageId: string) => void;
  getDisplayName?: (userId: string) => string;
  onOpenLightbox?: (attachment: AttachmentInfo) => void;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  message,
  senderDisplayName,
  isMe,
  isPinned = false,
  onQuoteClick,
  getDisplayName,
  onOpenLightbox,
}) => {
  return (
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
              {getDisplayName ? getDisplayName(message.replyTo.senderId) : 'User'}
            </span>
            <p className="reply-quote-snippet">{message.replyTo.text}</p>
          </div>
        </div>
      )}

      {/* Attachments (Images, PDFs) */}
      {message.attachments && message.attachments.length > 0 && (
        <AttachmentRenderer
          attachments={message.attachments}
          onOpenLightbox={onOpenLightbox}
          isSentByMe={isMe}
        />
      )}

      {/* Announcement Message Body */}
      {message.text && (
        <div className="announcement-body">
          <p className="announcement-text">{message.text}</p>
        </div>
      )}

      {/* Card Footer: Sender Meta & Timestamp */}
      <div className="announcement-footer">
        <div className="announcement-author-info">
          {senderDisplayName && (
            <span className="announcement-sender-name">{senderDisplayName}</span>
          )}
          <span className="role-badge badge-mentor announcement-role-tag">MENTOR</span>
        </div>

        <div className="announcement-meta-right">
          {isPinned && (
            <PinIcon
              size={11}
              filled
              className="message-time-pin-icon"
              title="Pinned message"
            />
          )}
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
  );
};
