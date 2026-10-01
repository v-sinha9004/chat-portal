import React from 'react';
import type { ChatMessage, AttachmentInfo } from '../../types';
import { AnnouncementCard } from '../announcements/AnnouncementCard';
import { DoubtCard } from '../doubts/DoubtCard';
import { MessageBubble } from './MessageBubble';

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string | null;
  currentUserRole: string;
  isGroup: boolean;
  isMentor: boolean;
  directUserRole?: string;
  senderDisplayName: string;
  isPinned: boolean;
  canManagePins: boolean;
  getDisplayName: (userId: string) => string;
  getUserRole: (userId: string) => string;
  onInitiateReply: (message: ChatMessage) => void;
  onQuoteClick: (messageId: string) => void;
  onOpenLightbox: (attachment: AttachmentInfo) => void;
  onPinMessage: (message: ChatMessage) => Promise<void>;
  onUnpinMessage: (message: ChatMessage) => Promise<void>;
  onUpdateDoubtStatus: (messageId: string, status: 'OPEN' | 'RESOLVED') => Promise<void>;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  currentUserRole,
  isGroup,
  isMentor,
  directUserRole,
  senderDisplayName,
  isPinned,
  canManagePins,
  getDisplayName,
  getUserRole,
  onInitiateReply,
  onQuoteClick,
  onOpenLightbox,
  onPinMessage,
  onUnpinMessage,
  onUpdateDoubtStatus,
}) => {
  const isMe = message.senderId === currentUserId;

  if (message.isAnnouncement) {
    return (
      <AnnouncementCard
        key={message.id}
        message={message}
        senderDisplayName={senderDisplayName}
        isMe={isMe}
        onReply={onInitiateReply}
        onQuoteClick={onQuoteClick}
        getDisplayName={getDisplayName}
        isPinned={isPinned}
        onOpenLightbox={onOpenLightbox}
        onPin={
          canManagePins
            ? () => (isPinned ? onUnpinMessage(message) : onPinMessage(message))
            : undefined
        }
      />
    );
  }

  if (message.isDoubt) {
    const canResolve = isMentor || isMe;
    const senderRole = isMe
      ? currentUserRole
      : isGroup
      ? getUserRole(message.senderId)
      : directUserRole;

    return (
      <DoubtCard
        key={message.id}
        message={message}
        senderDisplayName={senderDisplayName}
        senderRole={senderRole}
        isMe={isMe}
        canResolve={canResolve}
        onUpdateStatus={onUpdateDoubtStatus}
        onReply={onInitiateReply}
        onQuoteClick={onQuoteClick}
        getDisplayName={getDisplayName}
        isPinned={isPinned}
        onOpenLightbox={onOpenLightbox}
        onPin={
          canManagePins
            ? () => (isPinned ? onUnpinMessage(message) : onPinMessage(message))
            : undefined
        }
      />
    );
  }

  return (
    <div
      key={message.id}
      id={`msg-${message.id}`}
      className={`message-row ${isMe ? 'sent' : 'received'}`}
    >
      <div className="message-bubble-wrapper">
        <MessageBubble
          message={message}
          isMe={isMe}
          isGroup={isGroup}
          senderDisplayName={senderDisplayName}
          getDisplayName={getDisplayName}
          onQuoteClick={onQuoteClick}
          onOpenLightbox={onOpenLightbox}
        />

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
      </div>
    </div>
  );
};
