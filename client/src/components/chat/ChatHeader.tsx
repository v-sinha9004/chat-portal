import React from 'react';
import type { ActiveConversation, UserPresence, GroupPresence } from '@/types';
import { PinnedMessageCarousel } from '@/components/pins';
import { GroupChatHeader } from './header/GroupChatHeader';
import { DirectChatHeader } from './header/DirectChatHeader';

interface ChatHeaderProps {
  activeConversation: ActiveConversation;
  activePresence: UserPresence | null;
  activeGroupPresence: GroupPresence | null;
  isLoadingPresence: boolean;
  activeTypingUserIds: string[];
  typingText: string | null;
  canManagePins: boolean;
  onBack: () => void;
  onPinClick: (targetMessageId: string) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeConversation,
  activePresence,
  activeGroupPresence,
  isLoadingPresence,
  activeTypingUserIds,
  typingText,
  canManagePins,
  onBack,
  onPinClick,
}) => {
  const isTyping = activeTypingUserIds.length > 0;

  return (
    <>
      <header className="chat-header">
        <div className="chat-header-user">
          <button
            type="button"
            className="mobile-back-btn"
            onClick={onBack}
            aria-label="Back to conversations"
            title="Back to conversations"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          {activeConversation.type === 'group' ? (
            <GroupChatHeader
              group={activeConversation.group}
              activeGroupPresence={activeGroupPresence}
              isTyping={isTyping}
              typingText={typingText}
            />
          ) : (
            <DirectChatHeader
              user={activeConversation.user}
              activePresence={activePresence}
              isLoadingPresence={isLoadingPresence}
              isTyping={isTyping}
            />
          )}
        </div>
      </header>

      {/* Pinned Messages Carousel */}
      <PinnedMessageCarousel
        onPinClick={onPinClick}
        canManagePins={canManagePins}
      />
    </>
  );
};
