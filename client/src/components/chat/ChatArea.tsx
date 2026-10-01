import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  useChatActions,
  useMessageWindowState,
  usePresenceState,
  usePinsState,
  useConversationState,
} from '@/store/selectors';
import type { ChatMessage, AttachmentInfo } from '@/types';
import { navigateToMessage } from '@/utils/messageNavigation';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import { ReportConfirmationModal } from '@/components/modals';
import { reportMessageRest } from '@/services/chatService';
import { useToastStore } from '@/store/useToastStore';
import { useChatScroll } from './hooks/useChatScroll';
import { useChatTyping } from './hooks/useChatTyping';
import { useMediaAttachment } from './hooks/useMediaAttachment';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatComposer } from './ChatComposer';
import {
  resolveDisplayName,
  resolveUserRole,
  formatTypingText,
} from './utils/chatUserHelpers';

export const ChatArea: React.FC = () => {
  const currentUserId = useAuthStore((s) => s.user?.id || null);
  const currentUserRole = useAuthStore((s) => s.user?.role || '');
  const isMentor =
    currentUserRole.toUpperCase() === 'MENTOR' || currentUserRole.toUpperCase() === 'ADMIN';

  // Grouped Store Subscriptions via useShallow
  const {
    activeConversation,
    users,
    isSocketConnected,
    isLoadingConversations: isLoadingInitial,
    conversationsError: errorInitial,
  } = useConversationState();

  const {
    activePresence,
    activeGroupPresence,
    isLoadingPresence,
    typingUsersByConversation,
  } = usePresenceState();

  const {
    messages,
    isLoadingMessages,
    messageError: messageFetchError,
    hasMoreMessages,
    isLoadingOlderMessages,
    hasNewerMessages,
    isLoadingNewerMessages,
    isLoadingContext,
    unseenLiveCountWhileInHistory,
    replyingTo,
  } = useMessageWindowState();

  const { pinnedMessages } = usePinsState();

  const {
    selectConversation,
    sendMessage,
    fetchMessages,
    loadOlderMessages,
    loadNewerMessages,
    jumpToMessage,
    jumpToLatest,
    setReplyingTo,
    updateDoubtStatus,
    pinMessage,
    unpinMessage,
    sendTypingStart,
    sendTypingStop,
  } = useChatActions();

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
    return formatTypingText(activeTypingUserIds, {
      currentUserId,
      activeConversation,
      users,
    });
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
  const [reportingMessage, setReportingMessage] = useState<ChatMessage | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const getDisplayName = useCallback(
    (userId: string) =>
      resolveDisplayName(userId, {
        currentUserId,
        activeConversation,
        users,
      }),
    [currentUserId, activeConversation, users],
  );

  const getUserRole = useCallback(
    (userId: string) =>
      resolveUserRole(userId, {
        currentUserId,
        currentUserRole,
        activeConversation,
        users,
      }),
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

  const handleInitiateReport = useCallback((msg: ChatMessage) => {
    setReportingMessage(msg);
  }, []);

  const handleConfirmReport = useCallback(async () => {
    const target = reportingMessage;
    setReportingMessage(null);
    if (!target) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) {
      showToast({
        message: 'Authentication session expired',
        type: 'error',
      });
      return;
    }

    const toastId = showToast({
      message: 'submitting a report',
      type: 'loading',
      duration: 0,
    });

    try {
      await reportMessageRest(token, target.id);
      showToast({
        id: toastId,
        message: 'Thank you for reporting.',
        type: 'success',
        duration: 3500,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to submit report';
      showToast({
        id: toastId,
        message: errorMessage,
        type: 'error',
        duration: 4000,
      });
    }
  }, [reportingMessage, showToast]);


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
        onReportMessage={handleInitiateReport}
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

      {/* Confirmation Modal for Reporting Message */}
      <ReportConfirmationModal
        isOpen={Boolean(reportingMessage)}
        message={reportingMessage}
        onClose={() => setReportingMessage(null)}
        onConfirm={handleConfirmReport}
      />
    </main>
  );
};

