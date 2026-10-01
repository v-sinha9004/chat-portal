import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import type { ChatMessage, AttachmentInfo } from '../types';
import { navigateToMessage } from '../utils/messageNavigation';
import { MediaLightbox } from './media/MediaLightbox';
import { useChatScroll } from './chat/hooks/useChatScroll';
import { useChatTyping } from './chat/hooks/useChatTyping';
import { useMediaAttachment } from './chat/hooks/useMediaAttachment';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { ChatComposer } from './chat/ChatComposer';

export const ChatArea: React.FC = () => {
  const currentUserId = useAuthStore((s) => s.user?.id || null);
  const currentUserRole = useAuthStore((s) => s.user?.role || '');
  const isMentor =
    currentUserRole.toUpperCase() === 'MENTOR' || currentUserRole.toUpperCase() === 'ADMIN';

  const activeConversation = useChatStore((s) => s.activeConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const activePresence = useChatStore((s) => s.activePresence);
  const activeGroupPresence = useChatStore((s) => s.activeGroupPresence);
  const isLoadingPresence = useChatStore((s) => s.isLoadingPresence);
  const users = useChatStore((s) => s.users);
  const isSocketConnected = useChatStore((s) => s.isSocketConnected);
  const isLoadingInitial = useChatStore((s) => s.isLoadingConversations);
  const errorInitial = useChatStore((s) => s.conversationsError);

  const messages = useChatStore((s) => s.messages);
  const isLoadingMessages = useChatStore((s) => s.isLoadingMessages);
  const messageFetchError = useChatStore((s) => s.messageError);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages);
  const isLoadingOlderMessages = useChatStore((s) => s.isLoadingOlderMessages);
  const loadOlderMessages = useChatStore((s) => s.loadOlderMessages);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);

  // Bidirectional window state and actions
  const hasNewerMessages = useChatStore((s) => s.hasNewerMessages);
  const isLoadingNewerMessages = useChatStore((s) => s.isLoadingNewerMessages);
  const isLoadingContext = useChatStore((s) => s.isLoadingContext);
  const unseenLiveCountWhileInHistory = useChatStore((s) => s.unseenLiveCountWhileInHistory);
  const loadNewerMessages = useChatStore((s) => s.loadNewerMessages);
  const jumpToMessage = useChatStore((s) => s.jumpToMessage);
  const jumpToLatest = useChatStore((s) => s.jumpToLatest);
  const updateDoubtStatus = useChatStore((s) => s.updateDoubtStatus);
  const pinnedMessages = useChatStore((s) => s.pinnedMessages);
  const pinMessage = useChatStore((s) => s.pinMessage);
  const unpinMessage = useChatStore((s) => s.unpinMessage);

  // Typing tracking from store
  const typingUsersByConversation = useChatStore((s) => s.typingUsersByConversation);
  const sendTypingStart = useChatStore((s) => s.sendTypingStart);
  const sendTypingStop = useChatStore((s) => s.sendTypingStop);

  const activeKey = activeConversation
    ? activeConversation.type === 'group'
      ? `group:${activeConversation.id}`
      : `user:${activeConversation.id}`
    : null;

  const activeTypingUserIds = useMemo(() => {
    if (!activeKey) return [];
    return (typingUsersByConversation[activeKey] || []).filter(
      (id) => id !== currentUserId,
    );
  }, [activeKey, typingUsersByConversation, currentUserId]);

  const typingText = useMemo(() => {
    if (activeTypingUserIds.length === 0) return null;
    const names = activeTypingUserIds.map((id) => {
      if (id === currentUserId) return 'You';
      if (activeConversation?.type === 'direct') {
        if (activeConversation.user.id === id) {
          return activeConversation.user.name || `@${activeConversation.user.username}`;
        }
      }
      if (activeConversation?.type === 'group') {
        const member = activeConversation.group.members?.find((m) => m.userId === id);
        if (member?.user) {
          return member.user.name || (member.user.username ? `@${member.user.username}` : 'Member');
        }
      }
      const found = users.find((u) => u.id === id);
      return found?.name || (found?.username ? `@${found.username}` : 'Member');
    });
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      return `${names[0]}, ${names[1]} and ${names.length - 2} ${names.length - 2 === 1 ? 'other' : 'others'} are typing...`;
    }
  }, [activeTypingUserIds, currentUserId, activeConversation, users]);

  // Hook 1: Typing Indicator State & Throttling
  const { inputText, handleInputChange, clearInput } = useChatTyping({
    activeConversationId: activeConversation?.id,
    sendTypingStart,
    sendTypingStop,
  });

  // Hook 2: Media Attachment & Drag-Drop State
  const {
    pendingAttachment,
    isDraggingOver,
    fileInputRef,
    handleRemovePendingAttachment,
    processSelectedFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
  } = useMediaAttachment({
    activeConversationId: activeConversation?.id,
  });

  // Hook 3: Virtualized / Anchored Message Scrolling
  const {
    messagesContainerRef,
    messagesEndRef,
    isJumpingToLatestRef,
    scrollToBottom,
    triggerLoadOlder,
    handleScroll,
  } = useChatScroll({
    activeKey,
    messages,
    isLoadingMessages,
    hasMoreMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
    hasNewerMessages,
    isLoadingNewerMessages,
    loadNewerMessages,
    currentUserId,
    typingText,
  });

  const [lightboxAttachment, setLightboxAttachment] = useState<AttachmentInfo | null>(null);

  const getDisplayName = useCallback(
    (userId: string) => {
      if (userId === currentUserId) return 'You';

      if (activeConversation?.type === 'direct') {
        if (activeConversation.user.id === userId) {
          return activeConversation.user.name || `@${activeConversation.user.username}`;
        }
      }

      if (activeConversation?.type === 'group') {
        const member = activeConversation.group.members?.find((m) => m.userId === userId);
        if (member?.user) {
          return member.user.name || (member.user.username ? `@${member.user.username}` : 'Member');
        }
      }

      const found = users.find((u) => u.id === userId);
      return found?.name || (found?.username ? `@${found.username}` : 'Member');
    },
    [currentUserId, activeConversation, users],
  );

  const getUserRole = useCallback(
    (userId: string) => {
      if (userId === currentUserId) return currentUserRole;
      if (activeConversation?.type === 'direct') {
        if (activeConversation.user.id === userId) {
          return activeConversation.user.role || 'MENTEE';
        }
      }
      if (activeConversation?.type === 'group') {
        const member = activeConversation.group.members?.find((m) => m.userId === userId);
        if (member?.user) {
          return member.user.role || 'MENTEE';
        }
      }
      const found = users.find((u) => u.id === userId);
      return found?.role || 'MENTEE';
    },
    [currentUserId, currentUserRole, activeConversation, users],
  );

  const handleInitiateReply = useCallback(
    (msg: ChatMessage) => {
      setReplyingTo(msg);
    },
    [setReplyingTo],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && replyingTo) {
        setReplyingTo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replyingTo, setReplyingTo]);

  const handleQuoteClick = useCallback(
    async (targetMessageId: string) => {
      await navigateToMessage(targetMessageId, jumpToMessage, {
        onJumpingStateChange: (isJumping: boolean) => {
          isJumpingToLatestRef.current = isJumping;
        },
      });
    },
    [jumpToMessage, isJumpingToLatestRef],
  );

  const canManagePins = Boolean(activeConversation?.type === 'direct' || isMentor);

  const handlePinMessage = useCallback(
    async (msg: ChatMessage) => {
      await pinMessage(msg.id);
    },
    [pinMessage],
  );

  const handleUnpinMessage = useCallback(
    async (msg: ChatMessage) => {
      await unpinMessage(msg.id);
    },
    [unpinMessage],
  );

  const handleJumpToRecent = useCallback(async () => {
    isJumpingToLatestRef.current = true;
    await jumpToLatest();
    scrollToBottom('auto');
    requestAnimationFrame(() => {
      scrollToBottom('auto');
      setTimeout(() => {
        isJumpingToLatestRef.current = false;
      }, 400);
    });
  }, [jumpToLatest, scrollToBottom, isJumpingToLatestRef]);

  // Initial Empty / Loading States
  if (!activeConversation) {
    if (isLoadingInitial) {
      return (
        <main className="chat-main empty-state">
          <div className="empty-message-box">
            <div className="loading-spinner large" />
            <h3>Loading Conversations</h3>
            <p>Fetching contacts and groups from the server...</p>
          </div>
        </main>
      );
    }

    if (errorInitial) {
      return (
        <main className="chat-main empty-state">
          <div className="empty-message-box">
            <div className="empty-icon">⚠️</div>
            <h3>Unable to Load Chats</h3>
            <p>{errorInitial}</p>
          </div>
        </main>
      );
    }

    return (
      <main className="chat-main empty-state">
        <div className="empty-message-box">
          <div className="empty-icon">💬</div>
          <h3>No Conversation Selected</h3>
          <p>Please select a contact or a group from the list on the left to start messaging.</p>
        </div>
      </main>
    );
  }

  const isGroup = activeConversation.type === 'group';
  const group = isGroup ? activeConversation.group : null;
  const directUser = !isGroup ? activeConversation.user : null;

  return (
    <main
      className={`chat-main ${isDraggingOver ? 'dragging-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="chat-drop-overlay">
          <div className="chat-drop-overlay-content">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="chat-drop-icon"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h4 className="chat-drop-title">Drop file to attach</h4>
            <p className="chat-drop-desc">Supports images (JPG, PNG, WebP, GIF) and PDF up to 5 MB</p>
          </div>
        </div>
      )}

      {/* Header and Pinned Message Carousel */}
      <ChatHeader
        activeConversation={activeConversation}
        activePresence={activePresence}
        activeGroupPresence={activeGroupPresence}
        isLoadingPresence={isLoadingPresence}
        activeTypingUserIds={activeTypingUserIds}
        typingText={typingText}
        canManagePins={canManagePins}
        onBack={() => selectConversation(null)}
        onPinClick={handleQuoteClick}
      />

      {/* Message List, Bi-directional Scroller, Jump Pill, Typing Indicator */}
      <MessageList
        messagesContainerRef={messagesContainerRef}
        messagesEndRef={messagesEndRef}
        messages={messages}
        pinnedMessages={pinnedMessages}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        isGroup={isGroup}
        isMentor={isMentor}
        groupName={group?.name}
        directUserName={directUser?.name}
        directUserRole={directUser?.role}
        isLoadingContext={isLoadingContext}
        isLoadingMessages={isLoadingMessages}
        messageFetchError={messageFetchError}
        isLoadingOlderMessages={isLoadingOlderMessages}
        hasMoreMessages={hasMoreMessages}
        hasNewerMessages={hasNewerMessages}
        isLoadingNewerMessages={isLoadingNewerMessages}
        unseenLiveCountWhileInHistory={unseenLiveCountWhileInHistory}
        typingText={typingText}
        canManagePins={canManagePins}
        getDisplayName={getDisplayName}
        getUserRole={getUserRole}
        onScroll={handleScroll}
        onRetryFetch={() => fetchMessages()}
        onTriggerLoadOlder={triggerLoadOlder}
        onLoadNewerMessages={() => loadNewerMessages()}
        onJumpToRecent={handleJumpToRecent}
        onInitiateReply={handleInitiateReply}
        onQuoteClick={handleQuoteClick}
        onOpenLightbox={(att) => setLightboxAttachment(att)}
        onPinMessage={handlePinMessage}
        onUnpinMessage={handleUnpinMessage}
        onUpdateDoubtStatus={updateDoubtStatus}
      />

      {/* Chat Composer (Replying preview, Action dropdown, composers, staged attachment, input) */}
      <ChatComposer
        key={activeConversation.id}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        isGroup={isGroup}
        isMentor={isMentor}
        groupName={group?.name}
        directUserName={directUser?.name}
        isSocketConnected={isSocketConnected}
        replyingTo={replyingTo}
        pendingAttachment={pendingAttachment}
        fileInputRef={fileInputRef}
        inputText={inputText}
        getDisplayName={getDisplayName}
        onInputChange={handleInputChange}
        onPaste={handlePaste}
        onProcessSelectedFile={processSelectedFile}
        onRemovePendingAttachment={handleRemovePendingAttachment}
        onCancelReply={() => setReplyingTo(null)}
        onSendMessage={sendMessage}
        onClearInput={clearInput}
      />

      {/* Full-Screen Lightbox Modal for Images */}
      <MediaLightbox
        attachment={lightboxAttachment}
        onClose={() => setLightboxAttachment(null)}
      />
    </main>
  );
};
