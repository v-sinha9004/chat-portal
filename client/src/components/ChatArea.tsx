import React, { useState, useRef, useEffect } from 'react';
import type { User, ChatMessage } from '../types';

interface ChatAreaProps {
  selectedUser: User | null;
  currentUserId: string | null;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading?: boolean;
  error?: string | null;
  isSocketConnected?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  selectedUser,
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
  }, [messages, selectedUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!selectedUser) {
    if (isLoading) {
      return (
        <main className="chat-main empty-state">
          <div className="empty-message-box">
            <div className="loading-spinner large" />
            <h3>Loading Contacts</h3>
            <p>Fetching contacts from the server...</p>
          </div>
        </main>
      );
    }

    if (error) {
      return (
        <main className="chat-main empty-state">
          <div className="empty-message-box">
            <div className="empty-icon">⚠️</div>
            <h3>Unable to Load Contacts</h3>
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
          <p>Please select a contact from the list on the left to start direct messaging.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-main">
      <header className="chat-header">
        <div className="chat-header-user">
          <div className="avatar-wrapper">
            {selectedUser.avatarUrl ? (
              <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="avatar-img" />
            ) : (
              <div className={`avatar-placeholder avatar-${selectedUser.role.toLowerCase()}`}>
                {getInitials(selectedUser.name)}
              </div>
            )}
            {selectedUser.isActive && <span className="status-indicator online" />}
          </div>

          <div className="chat-header-details">
            <div className="chat-header-name-row">
              <h3>{selectedUser.name}</h3>
              <span className={`role-badge badge-${selectedUser.role.toLowerCase()}`}>
                {selectedUser.role}
              </span>
            </div>
            <div className="chat-header-sub">
              <span>@{selectedUser.username}</span>
              <span className="dot-separator">•</span>
              <span className="user-email-text">{selectedUser.email}</span>
              <span className="dot-separator">•</span>
              <span className={selectedUser.isActive ? 'status-text online' : 'status-text'}>
                {selectedUser.isActive ? 'Active' : 'Offline'}
              </span>
            </div>
            {selectedUser.bio && <div className="chat-header-bio">"{selectedUser.bio}"</div>}
          </div>
        </div>
      </header>

      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet with {selectedUser.name}.</p>
            <span className="no-messages-sub">Send a message below to start a live conversation!</span>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`message-row ${isMe ? 'sent' : 'received'}`}>
                  <div className="message-bubble">
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
              ? `Message ${selectedUser.name}...`
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
