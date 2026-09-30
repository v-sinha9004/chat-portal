import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import type { ChatMessage } from '../types';
import { AnnouncementCard } from './announcements/AnnouncementCard';
import { AnnouncementComposer } from './announcements/AnnouncementComposer';
import { MegaphoneIcon } from './announcements/MegaphoneIcon';
import { scrollToAndHighlightMessage } from '../utils/messageNavigation';

function formatLastSeen(timestamp?: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) {
    return '• Last seen just now';
  }
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `• Last seen ${mins}m ago`;
  }
  if (diffSec < 86400 && date.getDate() === now.getDate()) {
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `• Last seen today at ${timeStr}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `• Last seen yesterday at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `• Last seen ${dateStr} at ${timeStr}`;
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

  // Typing tracking from store
  const typingUsersByConversation = useChatStore((s) => s.typingUsersByConversation);
  const sendTypingStart = useChatStore((s) => s.sendTypingStart);
  const sendTypingStop = useChatStore((s) => s.sendTypingStop);

  const [inputText, setInputText] = useState('');
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [announcementHeading, setAnnouncementHeading] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastLoadedConvoKeyRef = useRef<string | null>(null);
  const justLoadedInitialRef = useRef<boolean>(false);
  const lastSeenTailMessageIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isPrependingOlderRef = useRef<boolean>(false);
  const isJumpingToLatestRef = useRef<boolean>(false);

  // Throttling and inactivity timers
  const isTypingRef = useRef(false);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTyping = useCallback(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingStop();
    }
  }, [sendTypingStop]);

  // Handle typing input changes with 2.5s debounce and 3s heartbeat
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!val.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingStart();

      // Refresh every 3 seconds while user continues typing continuously
      heartbeatIntervalRef.current = setInterval(() => {
        if (isTypingRef.current) {
          sendTypingStart();
        }
      }, 3000);
    }

    // Reset 2.5s pause timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    pauseTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2500);
  };

  // Stop typing if user switches conversation or unmounts
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [activeConversation?.id, stopTyping]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (behavior === 'auto' || behavior === 'instant') {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Handler to load earlier messages with scroll position retention
  const triggerLoadOlder = useCallback(() => {
    if (
      isJumpingToLatestRef.current ||
      isLoadingOlderMessages ||
      !hasMoreMessages ||
      isLoadingMessages
    ) {
      return;
    }
    const container = messagesContainerRef.current;
    if (container) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isPrependingOlderRef.current = true;
    }
    loadOlderMessages();
  }, [hasMoreMessages, isLoadingOlderMessages, isLoadingMessages, loadOlderMessages]);

  const handleScroll = useCallback(() => {
    if (isJumpingToLatestRef.current) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    // Trigger load when scrolled near the top
    if (container.scrollTop <= 60) {
      triggerLoadOlder();
    }

    // Trigger load newer messages when scrolled near bottom while in historical view
    if (
      hasNewerMessages &&
      !isLoadingNewerMessages &&
      !isLoadingMessages &&
      !isJumpingToLatestRef.current
    ) {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom <= 50) {
        loadNewerMessages();
      }
    }
  }, [triggerLoadOlder, hasNewerMessages, isLoadingNewerMessages, isLoadingMessages, loadNewerMessages]);

  // Reset announcement mode when active conversation changes
  useEffect(() => {
    setIsAnnouncementMode(false);
    setAnnouncementHeading('');
  }, [activeConversation?.id]);

  // Send message handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation || !currentUserId) return;

    if (isAnnouncementMode) {
      if (!announcementHeading.trim()) return;
      stopTyping();
      const text = inputText;
      const heading = announcementHeading;
      setInputText('');
      setAnnouncementHeading('');
      setIsAnnouncementMode(false);
      await sendMessage(text, { isAnnouncement: true, heading });
      return;
    }

    stopTyping();
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  const getUserName = getDisplayName;

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
      // 1. Try scrolling if target already rendered in DOM
      const scrolled = scrollToAndHighlightMessage(targetMessageId);
      if (scrolled) return;

      // 2. Fetch context slice around message
      isJumpingToLatestRef.current = true;
      const success = await jumpToMessage(targetMessageId);
      if (success) {
        requestAnimationFrame(() => {
          scrollToAndHighlightMessage(targetMessageId);
          setTimeout(() => {
            isJumpingToLatestRef.current = false;
          }, 400);
        });
      } else {
        isJumpingToLatestRef.current = false;
      }
    },
    [jumpToMessage],
  );

  const handleJumpToRecent = useCallback(async () => {
    isJumpingToLatestRef.current = true;
    lastLoadedConvoKeyRef.current = null; // Forces layout effect to scroll to bottom instantly when loaded
    await jumpToLatest();

    const doScrollToBottom = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    };

    doScrollToBottom();
    requestAnimationFrame(() => {
      doScrollToBottom();
      setTimeout(() => {
        isJumpingToLatestRef.current = false;
      }, 400);
    });
  }, [jumpToLatest]);

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
    const names = activeTypingUserIds.map((id) => getUserName(id));
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      return `${names[0]}, ${names[1]} and ${names.length - 2} ${names.length - 2 === 1 ? 'other' : 'others'} are typing...`;
    }
  }, [activeTypingUserIds, getUserName]);

  // Scroll adjustment when older messages are prepended
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isPrependingOlderRef.current && prevScrollHeightRef.current > 0) {
      const heightDelta = container.scrollHeight - prevScrollHeightRef.current;
      if (heightDelta > 0) {
        container.scrollTop = prevScrollTopRef.current + heightDelta;
      }
      isPrependingOlderRef.current = false;
      prevScrollHeightRef.current = 0;
      prevScrollTopRef.current = 0;
    }
  }, [messages]);

  // Instant scroll to bottom on initial message load for a conversation
  useLayoutEffect(() => {
    if (!activeKey || isLoadingMessages) return;

    if (lastLoadedConvoKeyRef.current !== activeKey) {
      const scrollToBottomInstant = () => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      };

      scrollToBottomInstant();
      const rafId = requestAnimationFrame(scrollToBottomInstant);
      lastLoadedConvoKeyRef.current = activeKey;
      justLoadedInitialRef.current = true;
      lastSeenTailMessageIdRef.current = messages[messages.length - 1]?.id || null;

      return () => cancelAnimationFrame(rafId);
    }
  }, [activeKey, isLoadingMessages, messages]);

  // Smooth scroll for new incoming/outgoing messages or typing indicator
  useEffect(() => {
    if (!activeKey || isLoadingMessages) return;

    if (justLoadedInitialRef.current) {
      justLoadedInitialRef.current = false;
      return;
    }

    const currentTailId = messages[messages.length - 1]?.id || null;
    const hasNewTailMessage = currentTailId && currentTailId !== lastSeenTailMessageIdRef.current;
    lastSeenTailMessageIdRef.current = currentTailId;

    if (hasNewTailMessage) {
      // In historical mode or while actively jumping/loading newer, DO NOT auto-scroll to the bottom!
      // This allows the user to browse downward without the view abruptly teleporting to the bottom.
      if (hasNewerMessages || isLoadingNewerMessages || isJumpingToLatestRef.current) {
        return;
      }

      // In live mode (!hasNewerMessages): only auto-scroll if user is already near bottom or sent own message
      const container = messagesContainerRef.current;
      if (container) {
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        const isLatestMine = messages[messages.length - 1]?.senderId === currentUserId;
        if (isLatestMine || distanceFromBottom < 150) {
          scrollToBottom('smooth');
        }
      } else {
        scrollToBottom('smooth');
      }
      return;
    }

    // If typing text appeared, only scroll to bottom if user is already near bottom and in live mode
    if (typingText && messagesContainerRef.current && !hasNewerMessages) {
      const container = messagesContainerRef.current;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 150) {
        scrollToBottom('smooth');
      }
    }
  }, [
    messages,
    typingText,
    activeKey,
    isLoadingMessages,
    hasNewerMessages,
    isLoadingNewerMessages,
    currentUserId,
    scrollToBottom,
  ]);

  // Reset tracked conversation if none is selected
  useEffect(() => {
    if (!activeKey) {
      lastLoadedConvoKeyRef.current = null;
      lastSeenTailMessageIdRef.current = null;
    }
  }, [activeKey]);

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
    <main className="chat-main">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-user">
          <button
            type="button"
            className="mobile-back-btn"
            onClick={() => selectConversation(null)}
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
          {isGroup && group ? (
            <>
              <div className="avatar-wrapper group-avatar">
                {group.avatarUrl ? (
                  <img src={group.avatarUrl} alt={group.name} className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder avatar-group-bg">
                    <span className="avatar-group-icon">👥</span>
                  </div>
                )}
              </div>

              <div className="chat-header-details">
                <div className="chat-header-name-row">
                  <h3>{group.name}</h3>
                  <span className="role-badge badge-group">Group</span>
                </div>
                <div className="chat-header-sub">
                  <span className="members-badge">
                    {group.memberCount ?? 1} {group.memberCount === 1 ? 'member' : 'members'}
                  </span>
                  {activeGroupPresence && (
                    <>
                      <span className="dot-separator">•</span>
                      <span className="group-online-badge">
                        <span className="presence-dot online mini" />
                        {activeGroupPresence.onlineCount} online
                      </span>
                    </>
                  )}
                  {activeTypingUserIds.length > 0 && (
                    <>
                      <span className="dot-separator">•</span>
                      <span className="group-typing-badge">{typingText}</span>
                    </>
                  )}
                  {group.description && (
                    <>
                      <span className="dot-separator">•</span>
                      <span className="group-desc-preview">{group.description}</span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : directUser ? (
            <>
              <div className="avatar-wrapper">
                {directUser.avatarUrl ? (
                  <img src={directUser.avatarUrl} alt={directUser.name} className="avatar-img" />
                ) : (
                  <div
                    className={`avatar-placeholder avatar-${(directUser.role || 'mentee').toLowerCase()}`}
                  >
                    {getInitials(directUser.name)}
                  </div>
                )}
                {activePresence?.isOnline && (
                  <span className="status-indicator online" title="Online" />
                )}
              </div>

              <div className="chat-header-details">
                <div className="chat-header-name-row">
                  <h3>{directUser.name}</h3>
                  <span
                    className={`role-badge badge-${(directUser.role || 'mentee').toLowerCase()}`}
                  >
                    {directUser.role}
                  </span>
                </div>
                <div className="chat-header-sub">
                  <span>@{directUser.username}</span>
                  <span className="dot-separator header-email-sep">•</span>
                  <span className="user-email-text">{directUser.email}</span>
                  <span className="dot-separator">•</span>
                  {activeTypingUserIds.length > 0 ? (
                    <span className="status-text typing">
                      <span className="presence-dot online mini" /> typing...
                    </span>
                  ) : isLoadingPresence ? (
                    <span className="status-text loading">Checking...</span>
                  ) : activePresence?.isOnline ? (
                    <span className="status-text online">
                      <span className="presence-dot online" /> Online
                    </span>
                  ) : (
                    <span className="status-text offline">
                      <span className="presence-dot offline" /> Offline{' '}
                      {formatLastSeen(activePresence?.lastSeen)}
                    </span>
                  )}
                </div>
                {directUser.bio && <div className="chat-header-bio">"{directUser.bio}"</div>}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {/* Messages Container */}
      <div
        className="chat-messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
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
              onClick={() => fetchMessages()}
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>
              No messages yet in {isGroup && group ? `#${group.name}` : directUser?.name}.
            </p>
            <span className="no-messages-sub">Send a message below to start a live conversation!</span>
          </div>
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
                  onClick={triggerLoadOlder}
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
              const isMe = msg.senderId === currentUserId;
              const senderDisplayName =
                msg.senderName || (isGroup ? getDisplayName(msg.senderId) : '');

              if (msg.isAnnouncement) {
                return (
                  <AnnouncementCard
                    key={msg.id}
                    message={msg}
                    senderDisplayName={senderDisplayName}
                    isMe={isMe}
                    onReply={handleInitiateReply}
                    onQuoteClick={handleQuoteClick}
                    getDisplayName={getDisplayName}
                  />
                );
              }

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`message-row ${isMe ? 'sent' : 'received'}`}
                >
                  <div className="message-bubble-wrapper">
                    <div className="message-bubble">
                      {/* Quoted Reply Card */}
                      {msg.replyTo && (
                        <div
                          className="reply-quote-card"
                          onClick={() => handleQuoteClick(msg.replyTo!.messageId)}
                          role="button"
                          tabIndex={0}
                          title="Click to jump to quoted message"
                        >
                          <div className="reply-quote-bar" />
                          <div className="reply-quote-body">
                            <span className="reply-quote-sender">
                              {getDisplayName(msg.replyTo.senderId)}
                            </span>
                            <p className="reply-quote-snippet">{msg.replyTo.text}</p>
                          </div>
                        </div>
                      )}

                      {/* In group chats, show sender's name above received messages */}
                      {isGroup && !isMe && senderDisplayName && (
                        <span className="message-sender-name">{senderDisplayName}</span>
                      )}

                      <p className="message-text">{msg.text}</p>
                      <div className="message-meta">
                        <span className="message-timestamp">{msg.timestamp}</span>
                        {isMe && msg.status && (
                          <span
                            className={`message-status status-${msg.status}`}
                            title={`Status: ${msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}`}
                          >
                            {msg.status === 'sending' && '⏱'}
                            {msg.status === 'sent' && '✓'}
                            {msg.status === 'delivered' && '✓✓'}
                            {msg.status === 'read' && '✓✓'}
                            {msg.status === 'failed' && '⚠️'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hover Reply Action Button */}
                    <button
                      type="button"
                      className="message-reply-btn"
                      onClick={() => handleInitiateReply(msg)}
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
            })}

            {hasNewerMessages && (
              <div className="messages-load-newer-wrapper">
                <button
                  type="button"
                  className="load-newer-btn"
                  onClick={() => loadNewerMessages()}
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
        <div className="jump-to-recent-container">
          <button
            type="button"
            className="jump-to-recent-btn"
            onClick={handleJumpToRecent}
            title="Jump to latest messages"
          >
            <span>Jump to Recent Messages ↓</span>
            {unseenLiveCountWhileInHistory > 0 && (
              <span className="jump-to-recent-badge">
                {unseenLiveCountWhileInHistory > 99 ? '99+' : unseenLiveCountWhileInHistory}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Typing Indicator Bar */}
      {typingText && (
        <div className="typing-indicator-bar" aria-live="polite">
          <div className="typing-dots">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <span className="typing-indicator-text">{typingText}</span>
        </div>
      )}

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

      {/* Input Form */}
      <form
        className={`chat-input-form ${isAnnouncementMode ? 'announcement-form-active' : ''}`}
        onSubmit={handleSubmit}
      >
        {isGroup && isMentor && (
          <button
            type="button"
            className={`announcement-toggle-btn ${isAnnouncementMode ? 'active' : ''}`}
            onClick={() => {
              setIsAnnouncementMode((prev) => !prev);
              if (isAnnouncementMode) {
                setAnnouncementHeading('');
              }
            }}
            title={isAnnouncementMode ? 'Exit announcement mode' : 'Post as Announcement'}
            aria-label={isAnnouncementMode ? 'Exit announcement mode' : 'Post as Announcement'}
          >
            <MegaphoneIcon
              size={18}
              color={isAnnouncementMode ? '#ea580c' : 'currentColor'}
            />
            <span className="announcement-toggle-label">Announcement</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          className={`chat-input ${isAnnouncementMode ? 'announcement-body-input' : ''}`}
          placeholder={
            isSocketConnected
              ? isAnnouncementMode
                ? 'Type announcement message...'
                : isGroup && group
                ? `Message #${group.name}...`
                : directUser
                ? `Message ${directUser.name}...`
                : 'Type a message...'
              : 'Connecting to chat server...'
          }
          value={inputText}
          onChange={handleInputChange}
          disabled={!isSocketConnected}
          autoFocus
        />
        <button
          type="submit"
          className={`chat-send-button ${isAnnouncementMode ? 'announcement-send-btn' : ''}`}
          disabled={
            !inputText.trim() ||
            !isSocketConnected ||
            (isAnnouncementMode && !announcementHeading.trim())
          }
        >
          {isAnnouncementMode ? 'Announce' : 'Send'}
        </button>
      </form>
    </main>
  );
};
