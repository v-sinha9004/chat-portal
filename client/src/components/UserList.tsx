import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useUIStore } from '../store/useUIStore';
import { getDirectConversationId, getGroupConversationId } from '../types';
import { CurrentUserCard } from './sidebar/CurrentUserCard';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { GroupListItem } from './sidebar/GroupListItem';
import { DirectUserListItem } from './sidebar/DirectUserListItem';
import { SidebarStatus } from './sidebar/SidebarStatus';

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

  const currentUserId = authUser?.id || null;
  const foundUser = users.find((u) => u.id === currentUserId);
  const activeUser = foundUser || authUser || null;
  const contacts = users.filter((u) => u.id !== currentUserId);
  const totalConversations = contacts.length + groups.length;

  return (
    <aside className="sidebar">
      {/* Current Logged-in User Identity Card */}
      <CurrentUserCard
        user={activeUser}
        isSocketConnected={isSocketConnected}
        onLogout={logout}
      />

      {/* Chats Header with Top '+' Action Button */}
      <SidebarHeader
        totalConversations={totalConversations}
        isLoading={isLoading}
        onOpenCreateGroup={openCreateGroup}
      />

      {/* Unified Conversation List */}
      <div className="user-list">
        <SidebarStatus
          isLoading={isLoading}
          error={error}
          totalConversations={totalConversations}
          onRetry={fetchConversations}
        />

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
              <GroupListItem
                key={`group-${group.id}`}
                group={group}
                isSelected={isSelected}
                hasUnread={hasUnread}
                unreadCount={unreadCount}
                isTyping={isGroupTyping}
                onSelect={(grp) => selectConversation({ type: 'group', id: grp.id, group: grp })}
              />
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
              <DirectUserListItem
                key={`user-${contact.id}`}
                contact={contact}
                isSelected={isSelected}
                hasUnread={hasUnread}
                unreadCount={unreadCount}
                isTyping={isContactTyping}
                onSelect={(usr) => selectConversation({ type: 'direct', id: usr.id, user: usr })}
              />
            );
          })}
      </div>
    </aside>
  );
};
