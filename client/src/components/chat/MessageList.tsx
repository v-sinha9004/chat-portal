import React from 'react';
import type { ChatMessage, PinnedMessage, AttachmentInfo } from '../../types';
import { MessageItem } from './MessageItem';
import { JumpToRecentPill } from './list/JumpToRecentPill';
import { TypingIndicatorBar } from './list/TypingIndicatorBar';
import { MessageListEmptyState } from './list/MessageListEmptyState';

interface MessageListProps {
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  pinnedMessages: PinnedMessage[];
  currentUserId: string | null;
  currentUserRole: string;
  isGroup: boolean;
  isMentor: boolean;
  groupName?: string;
  directUserName?: string;
  directUserRole?: string;
  isLoadingContext: boolean;
  isLoadingMessages: boolean;
  messageFetchError: string | null;
  isLoadingOlderMessages: boolean;
  hasMoreMessages: boolean;
  hasNewerMessages: boolean;
  isLoadingNewerMessages: boolean;
  unseenLiveCountWhileInHistory: number;
  typingText: string | null;
  canManagePins: boolean;
  getDisplayName: (userId: string) => string;
  getUserRole: (userId: string) => string;
  onScroll: () => void;
  onRetryFetch: () => void;
  onTriggerLoadOlder: () => void;
  onLoadNewerMessages: () => void;
  onJumpToRecent: () => void;
  onInitiateReply: (message: ChatMessage) => void;
  onQuoteClick: (messageId: string) => void;
  onOpenLightbox: (attachment: AttachmentInfo) => void;
  onPinMessage: (message: ChatMessage) => Promise<void>;
  onUnpinMessage: (message: ChatMessage) => Promise<void>;
  onUpdateDoubtStatus: (messageId: string, status: 'OPEN' | 'RESOLVED') => Promise<void>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messagesContainerRef,
  messagesEndRef,
  messages,
  pinnedMessages,
  currentUserId,
  currentUserRole,
  isGroup,
  isMentor,
  groupName,
  directUserName,
  directUserRole,
  isLoadingContext,
  isLoadingMessages,
  messageFetchError,
  isLoadingOlderMessages,
  hasMoreMessages,
  hasNewerMessages,
  isLoadingNewerMessages,
  unseenLiveCountWhileInHistory,
  typingText,
  canManagePins,
  getDisplayName,
  getUserRole,
  onScroll,
  onRetryFetch,
  onTriggerLoadOlder,
  onLoadNewerMessages,
  onJumpToRecent,
  onInitiateReply,
  onQuoteClick,
  onOpenLightbox,
  onPinMessage,
  onUnpinMessage,
  onUpdateDoubtStatus,
}) => {
  return (
    <>
      <div
        className="chat-messages-container"
        ref={messagesContainerRef}
        onScroll={onScroll}
      >
        {isLoadingContext && (
          <div className="context-loading-indicator">
            <div className="loading-spinner small" />
            <span>Jumping to message...</span>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="messages-loading-state">
            <div className="loading-spinner" />
            <p>Loading past messages...</p>
          </div>
        ) : messageFetchError ? (
          <div className="messages-error-state">
            <div className="empty-icon">⚠️</div>
            <p>{messageFetchError}</p>
            <button
              type="button"
              className="retry-btn"
              onClick={onRetryFetch}
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <MessageListEmptyState
            isGroup={isGroup}
            groupName={groupName}
            directUserName={directUserName}
          />
        ) : (
          <div className="messages-list">
            {isLoadingOlderMessages ? (
              <div className="load-older-indicator loading">
                <div className="loading-spinner small" />
                <span>Loading earlier messages...</span>
              </div>
            ) : hasMoreMessages ? (
              <div className="load-older-indicator">
                <button
                  type="button"
                  className="load-older-btn"
                  onClick={onTriggerLoadOlder}
                >
                  ↑ Load earlier messages
                </button>
              </div>
            ) : (
              <div className="messages-history-start">
                <span>Beginning of message history</span>
              </div>
            )}

            {messages.map((msg) => {
              const senderDisplayName =
                msg.senderName || (isGroup ? getDisplayName(msg.senderId) : '');
              const isMsgPinned = pinnedMessages.some((p) => p.messageId === msg.id);

              return (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  isGroup={isGroup}
                  isMentor={isMentor}
                  directUserRole={directUserRole}
                  senderDisplayName={senderDisplayName}
                  isPinned={isMsgPinned}
                  canManagePins={canManagePins}
                  getDisplayName={getDisplayName}
                  getUserRole={getUserRole}
                  onInitiateReply={onInitiateReply}
                  onQuoteClick={onQuoteClick}
                  onOpenLightbox={onOpenLightbox}
                  onPinMessage={onPinMessage}
                  onUnpinMessage={onUnpinMessage}
                  onUpdateDoubtStatus={onUpdateDoubtStatus}
                />
              );
            })}

            {hasNewerMessages && (
              <div className="messages-load-newer-wrapper">
                <button
                  type="button"
                  className="load-newer-btn"
                  onClick={onLoadNewerMessages}
                  disabled={isLoadingNewerMessages}
                >
                  {isLoadingNewerMessages ? 'Loading newer messages...' : '↓ Load newer messages'}
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Jump to Recent Messages Pill */}
      {hasNewerMessages && (
        <JumpToRecentPill
          unseenCount={unseenLiveCountWhileInHistory}
          onJump={onJumpToRecent}
        />
      )}

      {/* Typing Indicator Bar */}
      {typingText && <TypingIndicatorBar typingText={typingText} />}
    </>
  );
};
