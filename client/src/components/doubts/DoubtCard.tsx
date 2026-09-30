import React from 'react';
import type { ChatMessage } from '../../types';
import { QuestionMarkIcon } from './QuestionMarkIcon';

interface DoubtCardProps {
  message: ChatMessage;
  senderDisplayName?: string;
  senderRole?: string;
  isMe: boolean;
  canResolve: boolean;
  onUpdateStatus: (messageId: string, status: 'OPEN' | 'RESOLVED') => void;
  onReply?: (message: ChatMessage) => void;
  onQuoteClick?: (messageId: string) => void;
  getDisplayName?: (userId: string) => string;
  onPin?: (message: ChatMessage) => void;
  isPinned?: boolean;
}

export const DoubtCard: React.FC<DoubtCardProps> = ({
  message,
  senderDisplayName,
  senderRole = 'MENTEE',
  isMe,
  canResolve,
  onUpdateStatus,
  onReply,
  onQuoteClick,
  getDisplayName,
  onPin,
  isPinned = false,
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
    <div
      id={`msg-${message.id}`}
      className={`message-row doubt-row ${isMe ? 'sent' : 'received'}`}
      data-message-id={message.id}
    >
      <div className="message-bubble-wrapper">
        <div className={`doubt-card ${isResolved ? 'doubt-resolved' : 'doubt-open'}`}>
          {/* Top Header Banner */}
          <div className={`doubt-header-banner ${isResolved ? 'resolved-banner' : ''}`}>
            <div className="doubt-badge-row">
              <div className="doubt-badge-left">
                <span className="doubt-icon" aria-hidden="true">
                  <QuestionMarkIcon size={16} color="#ffffff" />
                </span>
                <span className="doubt-label">DOUBT</span>
              </div>

              {/* Status Pill */}
              <div className={`doubt-status-pill ${isResolved ? 'pill-resolved' : 'pill-open'}`}>
                <span className="doubt-status-dot" />
                <span className="doubt-status-text">
                  {isResolved ? 'RESOLVED' : 'UNRESOLVED'}
                </span>
              </div>
            </div>

            {/* Optional Topic Headline */}
            {message.doubtTopic ? (
              <h4 className="doubt-topic-headline">
                <span className="doubt-topic-tag">Topic:</span> {message.doubtTopic}
              </h4>
            ) : null}
          </div>

          {/* Quoted Reply Card if Doubt is replying to another message */}
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
                  {getDisplayName ? getDisplayName(message.replyTo.senderId) : message.replyTo.senderId}
                </span>
                <p className="reply-quote-snippet">{message.replyTo.text}</p>
              </div>
            </div>
          )}

          {/* Doubt Message Body */}
          <div className="doubt-body">
            <p className="doubt-text">{message.text}</p>
          </div>

          {/* Resolution Action Row */}
          <div className="doubt-resolution-bar">
            {isResolved ? (
              <div className="doubt-resolved-info">
                <span className="resolved-check-badge">✓</span>
                <span className="resolved-by-text">
                  Resolved{message.resolvedByName ? ` by ${message.resolvedByName}` : ''}
                  {formattedResolvedTime ? ` (${formattedResolvedTime})` : ''}
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
              <span
                className={`role-badge ${
                  senderRole.toUpperCase() === 'MENTOR'
                    ? 'badge-mentor'
                    : senderRole.toUpperCase() === 'ADMIN'
                    ? 'badge-admin'
                    : 'badge-mentee'
                } doubt-role-tag`}
              >
                {senderRole.toUpperCase()}
              </span>
            </div>

            <div className="doubt-meta-right">
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

        {/* Standard Hover Pin Button */}
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

        {/* Standard Hover Reply Button */}
        {onReply && (
          <button
            type="button"
            className="message-reply-btn"
            onClick={() => onReply(message)}
            title="Reply"
            aria-label="Reply to doubt"
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

