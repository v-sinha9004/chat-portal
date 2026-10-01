import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import type { ChatMessage, AttachmentInfo } from '../types';
import { AnnouncementComposer } from './announcements/AnnouncementComposer';
import { DoubtComposer } from './doubts/DoubtComposer';
import { CHAT_ACTION_ITEMS } from '../config/chatActionsConfig';
import { navigateToMessage } from '../utils/messageNavigation';
import { MediaLightbox } from './media/MediaLightbox';
import { useChatScroll } from './chat/hooks/useChatScroll';
import { useChatTyping } from './chat/hooks/useChatTyping';
import { useMediaAttachment } from './chat/hooks/useMediaAttachment';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const { inputText, setInputText, handleInputChange, stopTyping } = useChatTyping({
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

  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [announcementHeading, setAnnouncementHeading] = useState('');
  const [isDoubtMode, setIsDoubtMode] = useState(false);
  const [doubtTopic, setDoubtTopic] = useState('');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightboxAttachment, setLightboxAttachment] = useState<AttachmentInfo | null>(null);

  // Reset modes and action menu when active conversation changes
  useEffect(() => {
    setIsAnnouncementMode(false);
    setAnnouncementHeading('');
    setIsDoubtMode(false);
    setDoubtTopic('');
    setIsActionMenuOpen(false);
  }, [activeConversation?.id]);

  // Close action menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    if (isActionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionMenuOpen]);

  // Available special actions for current conversation & user role
  const isGroupConvo = activeConversation?.type === 'group';
  const availableActions = useMemo(() => {
    return CHAT_ACTION_ITEMS.filter((item) =>
      item.isAvailable({
        isGroup: isGroupConvo,
        isMentor: !!isMentor,
        isAdmin: currentUserRole?.toUpperCase() === 'ADMIN',
        role: currentUserRole,
      }),
    );
  }, [isGroupConvo, isMentor, currentUserRole]);

  const handleSelectAction = (actionId: string) => {
    setIsActionMenuOpen(false);
    if (actionId === 'announcement') {
      if (isAnnouncementMode) {
        setIsAnnouncementMode(false);
        setAnnouncementHeading('');
      } else {
        setIsAnnouncementMode(true);
        setIsDoubtMode(false);
        setDoubtTopic('');
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (actionId === 'doubt') {
      if (isDoubtMode) {
        setIsDoubtMode(false);
        setDoubtTopic('');
      } else {
        setIsDoubtMode(true);
        setIsAnnouncementMode(false);
        setAnnouncementHeading('');
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };



  const canSubmit =
    (inputText.trim().length > 0 ||
      (pendingAttachment?.attachmentInfo != null && !pendingAttachment.isUploading)) &&
    !pendingAttachment?.isUploading &&
    !pendingAttachment?.error &&
    isSocketConnected &&
    (!isAnnouncementMode || announcementHeading.trim().length > 0);

  // Send message handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !activeConversation || !currentUserId) return;

    const attachments = pendingAttachment?.attachmentInfo
      ? [pendingAttachment.attachmentInfo]
      : undefined;

    // Reset pending attachment state and revoke preview
    handleRemovePendingAttachment();

    if (isAnnouncementMode) {
      if (!announcementHeading.trim()) return;
      stopTyping();
      const text = inputText;
      const heading = announcementHeading;
      setInputText('');
      setAnnouncementHeading('');
      setIsAnnouncementMode(false);
      await sendMessage(text, { isAnnouncement: true, heading, attachments });
      return;
    }

    if (isDoubtMode) {
      stopTyping();
      const text = inputText;
      const topic = doubtTopic.trim() || undefined;
      setInputText('');
      setDoubtTopic('');
      setIsDoubtMode(false);
      await sendMessage(text, { isDoubt: true, doubtTopic: topic, attachments });
      return;
    }

    stopTyping();
    const text = inputText;
    setInputText('');
    await sendMessage(text, { attachments });
  };

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
      inputRef.current?.focus();
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
        onJumpingStateChange: (isJumping) => {
          isJumpingToLatestRef.current = isJumping;
        },
      });
    },
    [jumpToMessage],
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

      {/* Docked Reply Preview Bar */}
      {replyingTo && (
        <div className="replying-preview-bar">
          <div className="replying-preview-bar-indicator" />
          <div className="replying-preview-content">
            <span className="replying-preview-label">
              Replying to{' '}
              <strong className="replying-preview-author">
                {getDisplayName(replyingTo.senderId)}
              </strong>
            </span>
            <p className="replying-preview-text">{replyingTo.text}</p>
          </div>
          <button
            type="button"
            className="replying-preview-close-btn"
            onClick={() => setReplyingTo(null)}
            title="Cancel reply (Esc)"
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}

      {/* Announcement Composer (Only for mentors in groups) */}
      {isGroup && isMentor && isAnnouncementMode && (
        <AnnouncementComposer
          heading={announcementHeading}
          onHeadingChange={setAnnouncementHeading}
          onCancel={() => {
            setIsAnnouncementMode(false);
            setAnnouncementHeading('');
          }}
          disabled={!isSocketConnected}
        />
      )}

      {/* Doubt Composer */}
      {isDoubtMode && (
        <DoubtComposer
          topic={doubtTopic}
          onTopicChange={setDoubtTopic}
          onCancel={() => {
            setIsDoubtMode(false);
            setDoubtTopic('');
          }}
          disabled={!isSocketConnected}
        />
      )}

      {/* Docked Attachment Staging Bar */}
      {pendingAttachment && (
        <div className={`attachment-staging-bar ${pendingAttachment.error ? 'staging-error' : ''}`}>
          <div className="attachment-staging-chip">
            {pendingAttachment.isImage ? (
              <div className="attachment-staging-thumb-wrapper">
                <img
                  src={pendingAttachment.previewUrl}
                  alt={pendingAttachment.fileName}
                  className="attachment-staging-thumb"
                />
                {pendingAttachment.isUploading && (
                  <div className="attachment-staging-spinner-overlay">
                    <div className="attachment-staging-spinner" />
                  </div>
                )}
              </div>
            ) : (
              <div className="attachment-staging-pdf-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
            )}
            <div className="attachment-staging-info">
              <span className="attachment-staging-name" title={pendingAttachment.fileName}>
                {pendingAttachment.fileName}
              </span>
              <div className="attachment-staging-meta">
                <span className="attachment-staging-size">
                  {formatFileSize(pendingAttachment.fileSize)}
                </span>
                {pendingAttachment.isUploading && (
                  <span className="attachment-staging-status uploading">
                    Uploading {pendingAttachment.uploadProgress}%
                  </span>
                )}
                {!pendingAttachment.isUploading && !pendingAttachment.error && (
                  <span className="attachment-staging-status ready">✓ Ready to send</span>
                )}
                {pendingAttachment.error && (
                  <span className="attachment-staging-status error">
                    ⚠️ {pendingAttachment.error}
                  </span>
                )}
              </div>
              {pendingAttachment.isUploading && (
                <div className="attachment-staging-progress-bar-bg">
                  <div
                    className="attachment-staging-progress-bar-fill"
                    style={{ width: `${pendingAttachment.uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              className="attachment-staging-remove-btn"
              onClick={handleRemovePendingAttachment}
              title="Remove attachment"
              aria-label="Remove attachment"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        className={`chat-input-form ${isAnnouncementMode ? 'announcement-form-active' : ''} ${
          isDoubtMode ? 'doubt-form-active' : ''
        }`}
        onSubmit={handleSubmit}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              processSelectedFile(files[0]);
            }
          }}
        />

        {/* Plus Action Button & Dropdown Menu */}
        {availableActions.length > 0 && (
          <div className="chat-action-menu-container" ref={actionMenuRef}>
            <button
              type="button"
              className={`chat-action-plus-btn ${isActionMenuOpen ? 'menu-open' : ''} ${
                isAnnouncementMode || isDoubtMode ? 'mode-active' : ''
              }`}
              onClick={() => setIsActionMenuOpen((prev) => !prev)}
              title="Add special message..."
              aria-label="Add special message options"
              aria-expanded={isActionMenuOpen}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="plus-icon"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {isActionMenuOpen && (
              <div className="chat-action-dropdown-menu">
                <div className="chat-action-menu-header">Special Message</div>
                {availableActions.map((action) => {
                  const isCurrentActive =
                    (action.id === 'announcement' && isAnnouncementMode) ||
                    (action.id === 'doubt' && isDoubtMode);

                  return (
                    <button
                      key={action.id}
                      type="button"
                      className={`chat-action-menu-item ${isCurrentActive ? 'item-active' : ''}`}
                      onClick={() => handleSelectAction(action.id)}
                    >
                      <span className="action-item-icon" style={{ color: action.accentColor }}>
                        {action.icon({ size: 18, color: action.accentColor })}
                      </span>
                      <div className="action-item-content">
                        <span className="action-item-label">{action.label}</span>
                        {action.description && (
                          <span className="action-item-desc">{action.description}</span>
                        )}
                      </div>
                      {isCurrentActive && <span className="action-item-badge">Active</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Paperclip Attachment Button */}
        <button
          type="button"
          className="chat-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image or PDF (max 5 MB)"
          aria-label="Attach file"
          disabled={!isSocketConnected || pendingAttachment?.isUploading}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          className={`chat-input ${isAnnouncementMode ? 'announcement-body-input' : ''} ${
            isDoubtMode ? 'doubt-body-input' : ''
          }`}
          placeholder={
            isSocketConnected
              ? isAnnouncementMode
                ? 'Type announcement message...'
                : isDoubtMode
                ? 'Type your doubt or question...'
                : isGroup && group
                ? `Message #${group.name}...`
                : directUser
                ? `Message ${directUser.name}...`
                : 'Type a message...'
              : 'Connecting to chat server...'
          }
          value={inputText}
          onChange={handleInputChange}
          onPaste={handlePaste}
          disabled={!isSocketConnected}
          autoFocus
        />
        <button
          type="submit"
          className={`chat-send-button ${isAnnouncementMode ? 'announcement-send-btn' : ''} ${
            isDoubtMode ? 'doubt-send-btn' : ''
          }`}
          disabled={!canSubmit}
        >
          {isAnnouncementMode ? 'Announce' : isDoubtMode ? 'Ask Doubt' : 'Send'}
        </button>
      </form>

      {/* Full-Screen Lightbox Modal for Images */}
      <MediaLightbox
        attachment={lightboxAttachment}
        onClose={() => setLightboxAttachment(null)}
      />
    </main>
  );
};
