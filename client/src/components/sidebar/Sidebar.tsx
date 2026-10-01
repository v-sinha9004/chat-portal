import React, { useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  useConversationState,
  useUnreadState,
  usePresenceState,
  useChatActions,
} from '@/store/selectors';
import { useUIStore } from '@/store/useUIStore';
import { getDirectConversationId, getGroupConversationId } from '@/types';
import { CurrentUserCard } from './CurrentUserCard';
import { ChatListItem, type ChatListItemData } from './ChatListItem';
import { SidebarStatus } from './SidebarStatus';

export const Sidebar: React.FC = () => {
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const {
    users,
    groups,
    activeConversation,
    isLoadingConversations: isLoading,
    conversationsError: error,
    isSocketConnected,
  } = useConversationState();

  const {
    unreadCountsByConversation,
    unreadUserIds,
    unreadGroupIds,
  } = useUnreadState();

  const { typingUsersByConversation } = usePresenceState();

  const { selectConversation, fetchConversations } = useChatActions();

  const openCreateGroup = useUIStore((s) => s.openCreateGroup);

  const currentUserId = authUser?.id || null;
  const foundUser = users.find((u) => u.id === currentUserId);
  const activeUser = foundUser || authUser || null;
  const contacts = users.filter((u) => u.id !== currentUserId);
  const totalConversations = contacts.length + groups.length;

  // Combine groups and direct chat contacts into a single list
  const chatList = useMemo<ChatListItemData[]>(() => {
    const list: ChatListItemData[] = [
      ...groups.map((group) => ({ type: 'group' as const, group })),
      ...contacts.map((user) => ({ type: 'direct' as const, user })),
    ];
    return list.sort((a, b) => {
      const nameA = a.type === 'group' ? a.group.name : a.user.name;
      const nameB = b.type === 'group' ? b.group.name : b.user.name;
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [groups, contacts]);

  return (
    <aside className="sidebar">
      {/* Current Logged-in User Identity Card */}
      <CurrentUserCard
        user={activeUser}
        isSocketConnected={isSocketConnected}
        onLogout={logout}
        onCreateGroup={openCreateGroup}
      />


      {/* Unified Conversation List */}
      <div className="user-list">
        <SidebarStatus
          isLoading={isLoading}
          error={error}
          totalConversations={totalConversations}
          onRetry={fetchConversations}
        />

        {!isLoading &&
          !error &&
          chatList.map((item) => {
            if (item.type === 'group') {
              const { group } = item;
              const isSelected =
                activeConversation?.type === 'group' && activeConversation.id === group.id;
              const groupConvoId = getGroupConversationId(group.id);
              const unreadCount = unreadCountsByConversation[groupConvoId] || 0;
              const hasUnread = unreadCount > 0 || unreadGroupIds.has(group.id);
              const isGroupTyping =
                (typingUsersByConversation[`group:${group.id}`] || []).length > 0;

              return (
                <ChatListItem
                  key={`group-${group.id}`}
                  item={item}
                  isSelected={isSelected}
                  hasUnread={hasUnread}
                  unreadCount={unreadCount}
                  isTyping={isGroupTyping}
                  onSelect={selectConversation}
                />
              );
            }

            const { user: contact } = item;
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
              <ChatListItem
                key={`user-${contact.id}`}
                item={item}
                isSelected={isSelected}
                hasUnread={hasUnread}
                unreadCount={unreadCount}
                isTyping={isContactTyping}
                onSelect={selectConversation}
              />
            );
          })}
      </div>
    </aside>
  );
};


export const UserList = Sidebar;
