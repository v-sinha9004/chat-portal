import React from 'react';
import type { ChatMessage, AttachmentInfo } from '../../types';
import { AnnouncementCard } from '../announcements/AnnouncementCard';
import { DoubtCard } from '../doubts/DoubtCard';
import { MessageBubble } from './MessageBubble';
import { MessageHoverActions } from './item/MessageHoverActions';

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

        <MessageHoverActions
          message={message}
          isPinned={isPinned}
          canManagePins={canManagePins}
          onPinMessage={onPinMessage}
          onUnpinMessage={onUnpinMessage}
          onInitiateReply={onInitiateReply}
        />
      </div>
    </div>
  );
};
