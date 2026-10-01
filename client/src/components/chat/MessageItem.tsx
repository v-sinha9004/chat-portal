import React, { useState, useMemo } from 'react';
import type { ChatMessage, AttachmentInfo } from '@/types';
import { AnnouncementCard } from '@/components/announcements';
import { DoubtCard } from '@/components/doubts';
import { MessageBubble } from './MessageBubble';
import { MessageActionMenu } from './item/MessageActionMenu';
import { getMessageActions } from './item/messageActions';
import { useLongPress } from '@/hooks/useLongPress';

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
  onReportMessage: (message: ChatMessage) => void;
  onDeleteMessage: (message: ChatMessage) => void;
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
  onReportMessage,
  onDeleteMessage,
}) => {
  const isMe = message.senderId === currentUserId;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const rowVariantClass = message.isAnnouncement
    ? 'announcement-row'
    : message.isDoubt
    ? 'doubt-row'
    : '';

  // Mentee will not see delete option in group conversations
  const isMenteeInGroup = isGroup && currentUserRole.toUpperCase() === 'MENTEE';
  const canDelete = !isMenteeInGroup;

  // Configurable actions list (DRY & easily extensible)
  const actions = useMemo(
    () =>
      getMessageActions({
        message,
        isPinned,
        canManagePins,
        canDelete,
        onInitiateReply,
        onPinMessage,
        onUnpinMessage,
        onReportMessage,
        onDeleteMessage,
      }),
    [message, isPinned, canManagePins, canDelete, onInitiateReply, onPinMessage, onUnpinMessage, onReportMessage, onDeleteMessage]
  );



  // Mobile long-press handler
  const longPressHandlers = useLongPress({
    threshold: 450,
    onLongPress: () => {
      setIsMenuOpen(true);
    },
  });

  // Desktop right-click context menu handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen(true);
  };

  const renderContent = () => {
    if (message.isAnnouncement) {
      return (
        <AnnouncementCard
          message={message}
          senderDisplayName={senderDisplayName}
          isMe={isMe}
          isPinned={isPinned}
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
          isPinned={isPinned}
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
        isPinned={isPinned}
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
      <div
        className={`message-bubble-wrapper ${isMenuOpen ? 'menu-active' : ''}`}
        {...longPressHandlers}
        onContextMenu={handleContextMenu}
      >
        {renderContent()}

        {/* WhatsApp-style Top-Right Action Menu */}
        <MessageActionMenu
          actions={actions}
          isOpen={isMenuOpen}
          isMe={isMe}
          onToggle={() => setIsMenuOpen((prev) => !prev)}
          onClose={() => setIsMenuOpen(false)}
        />
      </div>
    </div>
  );
};
