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

  const rowVariantClass = message.isAnnouncement
    ? 'announcement-row'
    : message.isDoubt
    ? 'doubt-row'
    : '';

  const renderContent = () => {
    if (message.isAnnouncement) {
      return (
        <AnnouncementCard
          message={message}
          senderDisplayName={senderDisplayName}
          isMe={isMe}
          onQuoteClick={onQuoteClick}
          getDisplayName={getDisplayName}
          onOpenLightbox={onOpenLightbox}
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
          message={message}
          senderDisplayName={senderDisplayName}
          senderRole={senderRole}
          isMe={isMe}
          canResolve={canResolve}
          onUpdateStatus={onUpdateDoubtStatus}
          onQuoteClick={onQuoteClick}
          getDisplayName={getDisplayName}
          onOpenLightbox={onOpenLightbox}
        />
      );
    }

    return (
      <MessageBubble
        message={message}
        isMe={isMe}
        isGroup={isGroup}
        senderDisplayName={senderDisplayName}
        getDisplayName={getDisplayName}
        onQuoteClick={onQuoteClick}
        onOpenLightbox={onOpenLightbox}
      />
    );
  };

  return (
    <div
      key={message.id}
      id={`msg-${message.id}`}
      className={`message-row ${rowVariantClass} ${isMe ? 'sent' : 'received'}`.trim()}
      data-message-id={message.id}
    >
      <div className="message-bubble-wrapper">
        {renderContent()}

        {/* Unified Hover Actions for ALL message variants */}
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
