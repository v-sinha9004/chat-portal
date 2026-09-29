import React, { useState, useRef, useEffect } from 'react';
import type { User, ChatMessage, ActiveConversation } from '../types';

interface ChatAreaProps {
  activeConversation: ActiveConversation | null;
  users: User[];
  currentUserId: string | null;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading?: boolean;
  error?: string | null;
  isSocketConnected?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  activeConversation,
  users,
  currentUserId,
  messages,
  onSendMessage,
  isLoading = false,
  error = null,
  isSocketConnected = true,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeConversation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;
    onSendMessage(inputText.trim());
    setInputText('');
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

  const getUserName = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    return found?.name || `@${found?.username}` || 'User';
  };

  if (!activeConversation) {
    if (isLoading) {
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

    if (error) {
      return (
        <main className="chat-main empty-state">
          <div className="empty-message-box">
            <div className="empty-icon">⚠️</div>
            <h3>Unable to Load Chats</h3>
            <p>{error}</p>
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
      <header className="chat-header">
        <div className="chat-header-user">
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
                  <div className={`avatar-placeholder avatar-${(directUser.role || 'mentee').toLowerCase()}`}>
                    {getInitials(directUser.name)}
                  </div>
                )}
                {directUser.isActive && <span className="status-indicator online" />}
              </div>

              <div className="chat-header-details">
                <div className="chat-header-name-row">
                  <h3>{directUser.name}</h3>
                  <span className={`role-badge badge-${(directUser.role || 'mentee').toLowerCase()}`}>
                    {directUser.role}
                  </span>
                </div>
                <div className="chat-header-sub">
                  <span>@{directUser.username}</span>
                  <span className="dot-separator">•</span>
                  <span className="user-email-text">{directUser.email}</span>
                  <span className="dot-separator">•</span>
                  <span className={directUser.isActive ? 'status-text online' : 'status-text'}>
                    {directUser.isActive ? 'Active' : 'Offline'}
                  </span>
                </div>
                {directUser.bio && <div className="chat-header-bio">"{directUser.bio}"</div>}
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>
              No messages yet in {isGroup && group ? `#${group.name}` : directUser?.name}.
            </p>
            <span className="no-messages-sub">Send a message below to start a live conversation!</span>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              const senderDisplayName =
                msg.senderName || (isGroup ? getUserName(msg.senderId) : '');

              return (
                <div key={msg.id} className={`message-row ${isMe ? 'sent' : 'received'}`}>
                  <div className="message-bubble">
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
                          title={`Status: ${msg.status}`}
                        >
                          {msg.status === 'sending' ? '⏱' : msg.status === 'sent' ? '✓' : '⚠️'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder={
            isSocketConnected
              ? isGroup && group
                ? `Message #${group.name}...`
                : directUser
                ? `Message ${directUser.name}...`
                : 'Type a message...'
              : 'Connecting to chat server...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={!isSocketConnected}
          autoFocus
        />
        <button
          type="submit"
          className="chat-send-button"
          disabled={!inputText.trim() || !isSocketConnected}
        >
          Send
        </button>
      </form>
    </main>
  );
};
