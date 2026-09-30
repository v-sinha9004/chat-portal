import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useUIStore } from '../store/useUIStore';
import { getDirectConversationId, getGroupConversationId } from '../types';

export const UserList: React.FC = () => {
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const users = useChatStore((s) => s.users);
  const groups = useChatStore((s) => s.groups);
  const activeConversation = useChatStore((s) => s.activeConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const isLoading = useChatStore((s) => s.isLoadingConversations);
  const error = useChatStore((s) => s.conversationsError);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const isSocketConnected = useChatStore((s) => s.isSocketConnected);
  const unreadCountsByConversation = useChatStore(
    (s) => s.unreadCountsByConversation,
  );
  const unreadUserIds = useChatStore((s) => s.unreadUserIds);
  const unreadGroupIds = useChatStore((s) => s.unreadGroupIds);
  const typingUsersByConversation = useChatStore((s) => s.typingUsersByConversation);

  const openCreateGroup = useUIStore((s) => s.openCreateGroup);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentUserId = authUser?.id || null;

  // Close dropdown menu if clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleRetry = () => {
    fetchConversations();
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

  const getRoleBadgeClass = (role?: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return 'role-badge badge-admin';
      case 'MENTOR':
        return 'role-badge badge-mentor';
      case 'MENTEE':
        return 'role-badge badge-mentee';
      case 'GROUP':
        return 'role-badge badge-group';
      default:
        return 'role-badge';
    }
  };

  const foundUser = users.find((u) => u.id === currentUserId);
  const activeUser = foundUser || authUser || null;
  const contacts = users.filter((u) => u.id !== currentUserId);

  const totalConversations = contacts.length + groups.length;

  return (
    <aside className="sidebar">
      {/* Current Logged-in User Identity Card */}
      <div className="current-user-card">
        <div className="current-user-header">
          <span className="current-user-label">My Account</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className={`socket-status-badge ${isSocketConnected ? 'connected' : 'disconnected'}`}
              title={isSocketConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
            >
              <span className="socket-dot" />
              {isSocketConnected ? 'Connected' : 'Offline'}
            </span>
            <button
              type="button"
              className="current-user-logout-btn"
              onClick={logout}
              title="Sign out of your session"
            >
              Sign out
            </button>
          </div>
        </div>

        {activeUser && (
          <div className="current-user-info-row">
            <div className="current-user-avatar">
              {'avatarUrl' in activeUser && typeof activeUser.avatarUrl === 'string' ? (
                <img src={activeUser.avatarUrl} alt={activeUser.name || 'User'} />
              ) : (
                <div
                  className={`avatar-placeholder avatar-${(activeUser.role || 'mentee').toLowerCase()}`}
                >
                  {getInitials(activeUser.name || activeUser.email)}
                </div>
              )}
            </div>
            <div className="current-user-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="current-user-name">{activeUser.name || activeUser.email}</span>
                <span className={getRoleBadgeClass(activeUser.role)}>{activeUser.role}</span>
              </div>
              <span className="current-user-email">
                {activeUser.username ? `@${activeUser.username}` : activeUser.email}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chats Header with Top '+' Action Button */}
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2>Chats</h2>
            <span className="user-count-badge">
              {isLoading ? '...' : `${totalConversations}`}
            </span>
          </div>

          {/* '+' Button & Dropdown Menu */}
          <div className="sidebar-action-wrapper" ref={menuRef}>
            <button
              type="button"
              className="action-add-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="New chat options"
              aria-label="New chat options"
              aria-expanded={isMenuOpen}
            >
              +
            </button>

            {isMenuOpen && (
              <div className="action-dropdown-menu">
                <button
                  type="button"
                  className="dropdown-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    openCreateGroup();
                  }}
                >
                  <span className="dropdown-item-icon">👥</span>
                  <div className="dropdown-item-text">
                    <span className="dropdown-item-title">Create Group</span>
                    <span className="dropdown-item-desc">Chat with multiple members</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="sidebar-subtitle">Direct messages and group conversations</p>
      </div>

      {/* Unified Conversation List */}
      <div className="user-list">
        {isLoading && (
          <div className="user-skeletons" aria-label="Loading conversations">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton-user-item">
                <div className="skeleton-avatar" />
                <div className="skeleton-info">
                  <div className="skeleton-line skeleton-name" />
                  <div className="skeleton-line skeleton-username" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="user-list-error">
            <div className="error-icon">⚠️</div>
            <p className="error-message">{error}</p>
            <button type="button" className="retry-btn" onClick={handleRetry}>
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && totalConversations === 0 && (
          <div className="user-list-empty">
            <p>No conversations yet</p>
            <span className="user-list-empty-sub">
              Click <strong>+</strong> above to create a group or wait for contacts to appear.
            </span>
          </div>
        )}

        {/* Groups Section (if any groups exist) */}
        {!isLoading && !error && groups.length > 0 && (
          <div className="conversation-section-header">
            <span>Groups ({groups.length})</span>
          </div>
        )}

        {!isLoading &&
          !error &&
          groups.map((group) => {
            const isSelected =
              activeConversation?.type === 'group' && activeConversation.id === group.id;
            const groupConvoId = getGroupConversationId(group.id);
            const unreadCount = unreadCountsByConversation[groupConvoId] || 0;
            const hasUnread = unreadCount > 0 || unreadGroupIds.has(group.id);

            const isGroupTyping =
              (typingUsersByConversation[`group:${group.id}`] || []).length > 0;

            return (
              <div
                key={`group-${group.id}`}
                className={`user-item group-item ${isSelected ? 'active' : ''} ${
                  hasUnread ? 'has-unread' : ''
                }`}
                onClick={() => selectConversation({ type: 'group', id: group.id, group })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectConversation({ type: 'group', id: group.id, group });
                  }
                }}
              >
                <div className="avatar-wrapper group-avatar">
                  {group.avatarUrl ? (
                    <img src={group.avatarUrl} alt={group.name} className="avatar-img" />
                  ) : (
                    <div className="avatar-placeholder avatar-group-bg">
                      <span className="avatar-group-icon">👥</span>
                    </div>
                  )}
                </div>

                <div className="user-info">
                  <div className="user-info-top">
                    <span className="user-name">{group.name}</span>
                    <span className={getRoleBadgeClass('GROUP')}>Group</span>
                  </div>
                  <div className="user-username-row">
                    <span className="user-username">
                      {group.memberCount ?? 1} {group.memberCount === 1 ? 'member' : 'members'}
                    </span>
                    {unreadCount > 0 ? (
                      <span
                        className="unread-badge"
                        title={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : hasUnread ? (
                      <span className="unread-dot" title="New group message" />
                    ) : null}
                  </div>
                  {isGroupTyping ? (
                    <p className="user-typing-indicator-sidebar">
                      <span className="typing-dots mini">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </span>
                      <span>typing...</span>
                    </p>
                  ) : group.description ? (
                    <p className="user-bio">{group.description}</p>
                  ) : null}
                </div>
              </div>
            );
          })}

        {/* Direct Messages Section */}
        {!isLoading && !error && contacts.length > 0 && (
          <div className="conversation-section-header">
            <span>Direct Messages ({contacts.length})</span>
          </div>
        )}

        {!isLoading &&
          !error &&
          contacts.map((contact) => {
            const isSelected =
              activeConversation?.type === 'direct' && activeConversation.id === contact.id;
            const directConvoId = currentUserId
              ? getDirectConversationId(currentUserId, contact.id)
              : `direct:${contact.id}`;
            const unreadCount = unreadCountsByConversation[directConvoId] || 0;
            const hasUnread = unreadCount > 0 || unreadUserIds.has(contact.id);
            const isContactTyping =
              (typingUsersByConversation[`user:${contact.id}`] || []).length > 0;

            return (
              <div
                key={`user-${contact.id}`}
                className={`user-item ${isSelected ? 'active' : ''} ${
                  hasUnread ? 'has-unread' : ''
                }`}
                onClick={() => selectConversation({ type: 'direct', id: contact.id, user: contact })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectConversation({ type: 'direct', id: contact.id, user: contact });
                  }
                }}
              >
                <div className="avatar-wrapper">
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt={contact.name} className="avatar-img" />
                  ) : (
                    <div className={`avatar-placeholder avatar-${contact.role.toLowerCase()}`}>
                      {getInitials(contact.name)}
                    </div>
                  )}
                </div>

                <div className="user-info">
                  <div className="user-info-top">
                    <span className="user-name">{contact.name}</span>
                    <span className={getRoleBadgeClass(contact.role)}>{contact.role}</span>
                  </div>
                  <div className="user-username-row">
                    <span className="user-username">@{contact.username}</span>
                    {unreadCount > 0 ? (
                      <span
                        className="unread-badge"
                        title={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : hasUnread ? (
                      <span className="unread-dot" title="New direct message" />
                    ) : null}
                  </div>
                  {isContactTyping ? (
                    <p className="user-typing-indicator-sidebar">
                      <span className="typing-dots mini">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </span>
                      <span>typing...</span>
                    </p>
                  ) : contact.bio ? (
                    <p className="user-bio">{contact.bio}</p>
                  ) : (
                    <p className="user-email">{contact.email}</p>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
};
