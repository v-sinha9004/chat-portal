import React from 'react';
import type { ChatMessage, AttachmentInfo } from '@/types';
import { QuestionMarkIcon, PinIcon } from '@/components/icons';
import { AttachmentRenderer } from '@/components/media';

interface DoubtCardProps {
  message: ChatMessage;
  senderDisplayName?: string;
  senderRole?: string;
  isMe: boolean;
  isPinned?: boolean;
  canResolve: boolean;
  onUpdateStatus: (messageId: string, status: 'OPEN' | 'RESOLVED') => void;
  onQuoteClick?: (messageId: string) => void;
  getDisplayName?: (userId: string) => string;
  onOpenLightbox?: (attachment: AttachmentInfo) => void;
}

export const DoubtCard: React.FC<DoubtCardProps> = ({
  message,
  senderDisplayName,
  isMe,
  isPinned = false,
  canResolve,
  onUpdateStatus,
  onQuoteClick,
  getDisplayName,
  onOpenLightbox,
}) => {
  const isResolved = message.doubtStatus === 'RESOLVED';

  const handleToggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateStatus(message.id, isResolved ? 'OPEN' : 'RESOLVED');
  };

  const formattedResolvedTime = message.resolvedAt
    ? new Date(message.resolvedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';

  return (
    <div className={`doubt-card ${isResolved ? 'doubt-resolved' : 'doubt-open'}`}>
      {/* Top Header Banner */}
      <div className={`doubt-header-banner ${isResolved ? 'resolved-banner' : ''}`}>
        <div className="doubt-badge-row">
          <div className="doubt-badge-left">
            <span className="doubt-icon" aria-hidden="true">
              <QuestionMarkIcon size={15} color="#ffffff" />
            </span>
            <span className="doubt-label">DOUBT</span>
          </div>

          <span className={`doubt-status-pill ${isResolved ? 'pill-resolved' : 'pill-open'}`}>
            <span className="doubt-status-dot" />
            {isResolved ? 'RESOLVED' : 'OPEN'}
          </span>
        </div>

        {message.doubtTopic && (
          <div className="doubt-topic-tag">
            <span className="topic-hash">#</span>
            <span className="topic-name">{message.doubtTopic}</span>
          </div>
        )}
      </div>

      {/* Quoted Reply Card if Doubt is replying to a message */}
      {message.replyTo && (
        <div
          className="reply-quote-card doubt-quote-card"
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

      {/* Doubt Question / Message Body */}
      {message.text && (
        <div className="doubt-body">
          <p className="doubt-text">{message.text}</p>
        </div>
      )}

      {/* Resolution Action Row */}
      <div className="doubt-resolution-bar">
        {isResolved ? (
          <div className="doubt-resolved-info">
            <span className="resolved-check-badge">✓</span>
            <span className="resolved-by-text">
              Resolved at {formattedResolvedTime ? ` ${formattedResolvedTime}` : ''}
            </span>
            {canResolve && (
              <button
                type="button"
                className="doubt-reopen-btn"
                onClick={handleToggleStatus}
                title="Reopen this doubt"
              >
                Reopen
              </button>
            )}
          </div>
        ) : (
          canResolve && (
            <button
              type="button"
              className="doubt-resolve-btn"
              onClick={handleToggleStatus}
              title="Mark this doubt as resolved"
            >
              <span className="resolve-btn-icon">✓</span> Mark as Resolved
            </button>
          )
        )}
      </div>

      {/* Card Footer: Sender Meta & Timestamp */}
      <div className="doubt-footer">
        <div className="doubt-author-info">
          {senderDisplayName && (
            <span className="doubt-sender-name">{senderDisplayName}</span>
          )}
        </div>

        <div className="doubt-meta-right">
          {isPinned && (
            <PinIcon
              size={11}
              filled
              className="message-time-pin-icon"
              title="Pinned message"
            />
          )}
          <span className="doubt-timestamp">{message.timestamp}</span>
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
