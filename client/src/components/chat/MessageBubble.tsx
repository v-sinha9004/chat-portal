import React from 'react';
import type { ChatMessage, AttachmentInfo } from '@/types';
import { AttachmentRenderer } from '@/components/media';
import { MessagePinTimeIcon } from './item/MessagePinTimeIcon';

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  isGroup: boolean;
  isPinned?: boolean;
  senderDisplayName: string;
  getDisplayName: (userId: string) => string;
  onQuoteClick: (messageId: string) => void;
  onOpenLightbox: (attachment: AttachmentInfo) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  isGroup,
  isPinned = false,
  senderDisplayName,
  getDisplayName,
  onQuoteClick,
  onOpenLightbox,
}) => {
  return (
    <div className="message-bubble">
      {/* Quoted Reply Card */}
      {message.replyTo && (
        <div
          className="reply-quote-card"
          onClick={() => onQuoteClick(message.replyTo!.messageId)}
          role="button"
          tabIndex={0}
          title="Click to jump to quoted message"
        >
          <div className="reply-quote-bar" />
          <div className="reply-quote-body">
            <span className="reply-quote-sender">
              {getDisplayName(message.replyTo.senderId)}
            </span>
            <p className="reply-quote-snippet">{message.replyTo.text}</p>
          </div>
        </div>
      )}

      {/* In group chats, show sender's name above received messages */}
      {isGroup && !isMe && senderDisplayName && (
        <span className="message-sender-name">{senderDisplayName}</span>
      )}

      {/* Media Attachments (Images, PDFs) */}
      {message.attachments && message.attachments.length > 0 && (
        <AttachmentRenderer
          attachments={message.attachments}
          onOpenLightbox={onOpenLightbox}
          isSentByMe={isMe}
        />
      )}

      {/* Message Text (if non-empty) */}
      {message.text ? <p className="message-text">{message.text}</p> : null}

      <div className="message-meta">
        {isPinned && <MessagePinTimeIcon />}
        <span className="message-timestamp">{message.timestamp}</span>
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
  );
};
